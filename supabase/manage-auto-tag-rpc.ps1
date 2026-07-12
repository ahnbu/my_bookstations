param(
  [Parameter(Mandatory = $true)]
  [ValidateSet('Inspect', 'Apply', 'Verify', 'Rollback')]
  [string]$Action,

  [string]$ProjectRef = 'ugzruzaywohbynjzjesm',
  [string]$SqlPath = (Join-Path $PSScriptRoot '20260705_auto_tags_rpc.sql'),
  [string]$BackupPath = (Join-Path $PSScriptRoot '.temp/auto_tag_rpc_preapply.sql')
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Get-SupabaseAccessToken {
  if ($env:SUPABASE_ACCESS_TOKEN) {
    return $env:SUPABASE_ACCESS_TOKEN
  }

  if (-not ('Credential.NativeMethods' -as [type])) {
    Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;

namespace Credential {
  [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
  public struct NativeCredential {
    public UInt32 Flags;
    public UInt32 Type;
    public IntPtr TargetName;
    public IntPtr Comment;
    public System.Runtime.InteropServices.ComTypes.FILETIME LastWritten;
    public UInt32 CredentialBlobSize;
    public IntPtr CredentialBlob;
    public UInt32 Persist;
    public UInt32 AttributeCount;
    public IntPtr Attributes;
    public IntPtr TargetAlias;
    public IntPtr UserName;
  }

  public static class NativeMethods {
    [DllImport("Advapi32.dll", EntryPoint = "CredReadW", CharSet = CharSet.Unicode, SetLastError = true)]
    public static extern bool CredRead(string target, uint type, int reservedFlag, out IntPtr credentialPtr);

    [DllImport("Advapi32.dll", SetLastError = true)]
    public static extern void CredFree(IntPtr buffer);
  }
}
'@
  }

  $credentialPtr = [IntPtr]::Zero
  if (-not [Credential.NativeMethods]::CredRead('Supabase CLI:supabase', 1, 0, [ref]$credentialPtr)) {
    throw 'Supabase access token was not found in the process environment or Windows Credential Manager.'
  }

  try {
    $credential = [Runtime.InteropServices.Marshal]::PtrToStructure(
      $credentialPtr,
      [type][Credential.NativeCredential]
    )
    $bytes = [byte[]]::new($credential.CredentialBlobSize)
    [Runtime.InteropServices.Marshal]::Copy($credential.CredentialBlob, $bytes, 0, $bytes.Length)

    $utf8Token = [Text.Encoding]::UTF8.GetString($bytes).Trim([char]0)
    if ($utf8Token.StartsWith('sbp_')) {
      return $utf8Token
    }

    $unicodeToken = [Text.Encoding]::Unicode.GetString($bytes).Trim([char]0)
    if ($unicodeToken.StartsWith('sbp_')) {
      return $unicodeToken
    }

    throw 'The stored Supabase credential has an unexpected format.'
  }
  finally {
    [Credential.NativeMethods]::CredFree($credentialPtr)
  }
}

function Assert-ProjectRef {
  $repoRoot = Split-Path $PSScriptRoot -Parent
  $envPath = Join-Path $repoRoot '.env.local'
  if (-not (Test-Path -LiteralPath $envPath)) {
    throw '.env.local is required to verify the target Supabase project.'
  }

  $envText = Get-Content -LiteralPath $envPath -Raw
  $match = [regex]::Match($envText, '(?m)^VITE_SUPABASE_URL\s*=\s*["'']?https://([a-z0-9]+)\.supabase\.co')
  if (-not $match.Success) {
    throw 'VITE_SUPABASE_URL could not be parsed from .env.local.'
  }
  if ($match.Groups[1].Value -ne $ProjectRef) {
    throw 'The requested project ref does not match .env.local.'
  }
}

function Invoke-DatabaseQuery {
  param(
    [Parameter(Mandatory = $true)][string]$Sql,
    [Parameter(Mandatory = $true)][string]$Token
  )

  $uri = "https://api.supabase.com/v1/projects/$ProjectRef/database/query"
  $headers = @{ Authorization = "Bearer $Token" }
  $body = @{ query = $Sql } | ConvertTo-Json -Compress

  try {
    return @(Invoke-RestMethod -Method Post -Uri $uri -Headers $headers -ContentType 'application/json' -Body $body)
  }
  catch {
    throw 'Supabase Management API database query failed.'
  }
}

function Get-InspectionSql {
  return @'
with target as materialized (
  select us.user_id,
    (select tag->>'id' from jsonb_array_elements(coalesce(us.settings->'tagSettings'->'tags', '[]'::jsonb)) tag where tag->>'name' = '클로드' limit 1) as claude_id,
    (select tag->>'id' from jsonb_array_elements(coalesce(us.settings->'tagSettings'->'tags', '[]'::jsonb)) tag where tag->>'name' = 'AI' limit 1) as ai_id,
    (select tag->>'id' from jsonb_array_elements(coalesce(us.settings->'tagSettings'->'tags', '[]'::jsonb)) tag where tag->>'name' = '개인' limit 1) as personal_id
  from public.user_settings us
  where exists (
    select 1 from jsonb_array_elements(coalesce(us.settings->'tagSettings'->'tags', '[]'::jsonb)) tag
    where tag->>'name' = '클로드'
  )
  limit 1
), auth_context as materialized (
  select set_config('request.jwt.claim.sub', target.user_id::text, true) from target
), metadata as materialized (
  select
    pg_get_functiondef(to_regprocedure('public.get_tag_counts_for_user()')) as count_definition,
    pg_get_functiondef(to_regprocedure('public.get_books_by_tags(text[],boolean)')) as filter_definition,
    pg_get_functiondef(to_regprocedure('public.get_books_by_tags(text[])')) as legacy_definition,
    (select provolatile from pg_proc where oid = to_regprocedure('public.get_books_by_tags(text[],boolean)')) as filter_volatility,
    (select prosecdef from pg_proc where oid = to_regprocedure('public.get_books_by_tags(text[],boolean)')) as filter_security_definer,
    (select pronargdefaults from pg_proc where oid = to_regprocedure('public.get_books_by_tags(text[],boolean)')) as filter_default_count
)
select
  metadata.*,
  (select count(*) from public.user_library ul where ul.user_id = target.user_id) as total_books,
  (select count(*) from public.user_library ul where ul.user_id = target.user_id and coalesce(ul.book_data->'customTags', '[]'::jsonb) ? target.claude_id) as claude_custom,
  (select count(*) from public.user_library ul where ul.user_id = target.user_id and (coalesce(ul.book_data->'customTags', '[]'::jsonb) || coalesce(ul.book_data->'autoTags', '[]'::jsonb)) ? target.claude_id) as claude_merged,
  (select count(*) from public.get_books_by_tags(array[target.claude_id], false)) as claude_filter,
  (select count(*) from public.get_books_by_tags(array[target.claude_id], true)) as claude_favorite_filter,
  (select count(*) from public.get_books_by_tags(array[target.claude_id, target.ai_id], false)) as claude_ai_filter,
  (select count(*) from public.get_books_by_tags(array[target.claude_id, target.ai_id], true)) as claude_ai_favorite_filter,
  (select count(*) from public.get_books_by_tags(array[target.personal_id], false)) as personal_filter,
  (select book_count from public.get_tag_counts_for_user() where tag_id = target.claude_id) as claude_count,
  (select book_count from public.get_tag_counts_for_user() where tag_id = target.personal_id) as personal_count
from target
cross join auth_context
cross join metadata;
'@
}

function Get-Inspection {
  param([Parameter(Mandatory = $true)][string]$Token)

  $rows = Invoke-DatabaseQuery -Sql (Get-InspectionSql) -Token $Token
  if ($rows.Count -ne 1) {
    throw 'The target account or tag settings could not be resolved uniquely.'
  }
  return $rows[0]
}

function Get-PublicInspection {
  param([Parameter(Mandatory = $true)]$Row)

  return [ordered]@{
    total_books = [int]$Row.total_books
    claude_custom = [int]$Row.claude_custom
    claude_merged = [int]$Row.claude_merged
    claude_filter = [int]$Row.claude_filter
    claude_favorite_filter = [int]$Row.claude_favorite_filter
    claude_ai_filter = [int]$Row.claude_ai_filter
    claude_ai_favorite_filter = [int]$Row.claude_ai_favorite_filter
    personal_filter = [int]$Row.personal_filter
    claude_count = [int]$Row.claude_count
    personal_count = [int]$Row.personal_count
    filter_volatility = [string]$Row.filter_volatility
    filter_security_definer = [bool]$Row.filter_security_definer
    filter_default_count = [int]$Row.filter_default_count
    count_merges_auto_tags = ([string]$Row.count_definition).Contains("book_data->'autoTags'")
    filter_merges_auto_tags = ([string]$Row.filter_definition).Contains("book_data->'autoTags'")
  }
}

function Assert-Verification {
  param(
    [Parameter(Mandatory = $true)]$Row,
    [string]$ExpectedLegacyHash = ''
  )

  $checks = [ordered]@{
    count_merges_custom_tags = ([string]$Row.count_definition).Contains("book_data->'customTags'")
    count_merges_auto_tags = ([string]$Row.count_definition).Contains("book_data->'autoTags'")
    filter_merges_custom_tags = ([string]$Row.filter_definition).Contains("book_data->'customTags'")
    filter_merges_auto_tags = ([string]$Row.filter_definition).Contains("book_data->'autoTags'")
    filter_is_stable = ([string]$Row.filter_volatility -eq 's')
    filter_is_security_invoker = (-not [bool]$Row.filter_security_definer)
    filter_has_no_defaults = ([int]$Row.filter_default_count -eq 0)
    claude_count_is_14 = ([int]$Row.claude_count -eq 14)
    claude_filter_is_14 = ([int]$Row.claude_filter -eq 14)
    claude_favorite_is_4 = ([int]$Row.claude_favorite_filter -eq 4)
    claude_ai_is_14 = ([int]$Row.claude_ai_filter -eq 14)
    claude_ai_favorite_is_4 = ([int]$Row.claude_ai_favorite_filter -eq 4)
    personal_count_is_355 = ([int]$Row.personal_count -eq 355)
    personal_filter_is_355 = ([int]$Row.personal_filter -eq 355)
  }

  if ($ExpectedLegacyHash) {
    $legacyBytes = [Text.Encoding]::UTF8.GetBytes([string]$Row.legacy_definition)
    $actualLegacyHash = [Convert]::ToHexString([Security.Cryptography.SHA256]::HashData($legacyBytes))
    $checks.legacy_function_unchanged = ($actualLegacyHash -eq $ExpectedLegacyHash)
  }

  $failed = @($checks.GetEnumerator() | Where-Object { -not $_.Value } | ForEach-Object Key)
  if ($failed.Count -gt 0) {
    throw "Verification failed: $($failed -join ', ')"
  }

  return [ordered]@{
    verified = $true
    checks = $checks
    data = Get-PublicInspection -Row $Row
  }
}

function Get-BackupMetadata {
  $text = Get-Content -LiteralPath $BackupPath -Raw
  $match = [regex]::Match($text, '(?m)^-- legacy_sha256: ([A-F0-9]{64})$')
  return [ordered]@{
    text = $text
    legacy_hash = if ($match.Success) { $match.Groups[1].Value } else { '' }
  }
}

function Write-JsonResult {
  param([Parameter(Mandatory = $true)]$Value)
  $Value | ConvertTo-Json -Depth 8 -Compress | Write-Output
}

Assert-ProjectRef
$token = Get-SupabaseAccessToken

switch ($Action) {
  'Inspect' {
    $row = Get-Inspection -Token $token
    Write-JsonResult ([ordered]@{ inspected = $true; data = Get-PublicInspection -Row $row })
  }

  'Verify' {
    $legacyHash = ''
    if (Test-Path -LiteralPath $BackupPath) {
      $legacyHash = (Get-BackupMetadata).legacy_hash
    }
    $verification = Assert-Verification -Row (Get-Inspection -Token $token) -ExpectedLegacyHash $legacyHash
    Write-JsonResult $verification
  }

  'Apply' {
    if (Test-Path -LiteralPath $BackupPath) {
      throw 'The backup path already exists. Refusing to overwrite it.'
    }
    if (-not (Test-Path -LiteralPath $SqlPath)) {
      throw 'The SQL source file does not exist.'
    }

    $before = Get-Inspection -Token $token
    $legacyBytes = [Text.Encoding]::UTF8.GetBytes([string]$before.legacy_definition)
    $legacyHash = [Convert]::ToHexString([Security.Cryptography.SHA256]::HashData($legacyBytes))
    $backupSql = "-- legacy_sha256: $legacyHash`n$($before.count_definition.Trim())`n`n$($before.filter_definition.Trim())`n"
    $backupDirectory = Split-Path $BackupPath -Parent
    [IO.Directory]::CreateDirectory($backupDirectory) | Out-Null
    [IO.File]::WriteAllText($BackupPath, $backupSql, [Text.UTF8Encoding]::new($false))

    try {
      $sourceSql = Get-Content -LiteralPath $SqlPath -Raw
      Invoke-DatabaseQuery -Sql $sourceSql -Token $token | Out-Null
      $verification = Assert-Verification -Row (Get-Inspection -Token $token) -ExpectedLegacyHash $legacyHash
      Write-JsonResult ([ordered]@{ applied = $true; rollback_executed = $false; verification = $verification })
    }
    catch {
      $backup = Get-BackupMetadata
      Invoke-DatabaseQuery -Sql $backup.text -Token $token | Out-Null
      Write-JsonResult ([ordered]@{ applied = $false; rollback_executed = $true; error = 'Post-apply verification failed.' })
      exit 1
    }
  }

  'Rollback' {
    if (-not (Test-Path -LiteralPath $BackupPath)) {
      throw 'The rollback backup file does not exist.'
    }
    $backup = Get-BackupMetadata
    Invoke-DatabaseQuery -Sql $backup.text -Token $token | Out-Null
    $row = Get-Inspection -Token $token
    if ([int]$row.claude_filter -ne 0 -or [int]$row.personal_filter -ne 355) {
      throw 'Rollback completed, but the pre-apply data baseline did not return.'
    }
    Write-JsonResult ([ordered]@{ rolled_back = $true; data = Get-PublicInspection -Row $row })
  }
}
