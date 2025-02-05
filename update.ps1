# Script version
$SCRIPT_VERSION = 1

# ANSI color codes for Windows PowerShell
$RED = "`e[31m"
$GREEN = "`e[32m"
$YELLOW = "`e[33m"
$BLUE = "`e[34m"
$BOLD = "`e[1m"
$NC = "`e[0m"

# Error handling preference
$ErrorActionPreference = "Stop"

# Functions for formatted output
function Write-LogInfo {
    param($Message)
    Write-Host "${BLUE}[INFO]${NC} $Message"
}

function Write-LogSuccess {
    param($Message)
    Write-Host "${GREEN}[SUCCESS]${NC} $Message"
}

function Write-LogWarning {
    param($Message)
    Write-Host "${YELLOW}[WARNING]${NC} $Message"
}

function Write-LogError {
    param($Message)
    Write-Host "${RED}[ERROR]${NC} $Message"
}

# Function to check if a command exists
function Test-CommandExists {
    param($Command)
    return [bool](Get-Command -Name $Command -ErrorAction SilentlyContinue)
}

# Function to download a file
function Get-RemoteFile {
    param(
        $Url,
        $OutputFile
    )
    try {
        Invoke-WebRequest -Uri $Url -OutFile $OutputFile -UseBasicParsing
    }
    catch {
        Write-LogError "Failed to download file from $Url"
        throw $_
    }
}

# Function to normalize compose file for comparison
function Get-NormalizedCompose {
    param($FilePath)
    
    $content = Get-Content $FilePath
    $content = $content -replace 'ADMIN_PASSWORD=.*', 'ADMIN_PASSWORD=__PLACEHOLDER__'
    $content = $content -replace 'DB_PASSWORD=.*', 'DB_PASSWORD=__PLACEHOLDER__'
    $content = $content -replace 'POSTGRES_PASSWORD=.*', 'POSTGRES_PASSWORD=__PLACEHOLDER__'
    $content = $content -replace 'TZ=.*', 'TZ=__PLACEHOLDER__'
    $content = $content -replace '"(\d+):(\d+)"', '"__PORT__:$2"'
    $content = $content -replace 'DB_HOST=.*', 'DB_HOST=__PLACEHOLDER__'
    return $content
}

# Function to run docker compose with proper syntax
function Invoke-DockerCompose {
    param($Command)
    
    if (Test-CommandExists "docker") {
        if (docker compose version 2>$null) {
            docker compose $Command
        }
        elseif (Test-CommandExists "docker-compose") {
            docker-compose $Command
        }
        else {
            Write-LogError "Neither 'docker compose' nor 'docker-compose' commands are working."
            Write-LogError "Please ensure Docker Compose is properly installed."
            exit 1
        }
    }
    else {
        Write-LogError "Docker is not installed or not in PATH"
        exit 1
    }
}

# Print welcome message
Write-Host "`n${BLUE}=========================================${NC}"
Write-Host "${BLUE}   ALPR Database Update Script${NC}"
Write-Host "${BLUE}=========================================${NC}`n"

# Display main menu
Write-Host "${BOLD}What would you like to do?${NC}"
Write-Host "1) Update"
Write-Host "2) Revert to a previous version"
Write-Host ""

do {
    $choice = Read-Host "${BOLD}Enter your choice (1-2)${NC}"
} while ($choice -notin '1','2')

switch ($choice) {
    '1' {
        # Update path
        Write-Host "`n${BOLD}Select release type:${NC}"
        Write-Host "1) Stable (recommended)"
        Write-Host "2) Nightly (pre-release / latest updates)"
        Write-Host ""
        
        do {
            $release_type = Read-Host "${BOLD}Enter your choice (1-2)${NC}"
        } while ($release_type -notin '1','2')

        # Set branch based on release type
        if ($release_type -eq "1") {
            $BRANCH = "main"
            $IMAGE_TAG = "latest"
        }
        else {
            $BRANCH = "dev"
            $IMAGE_TAG = "nightly"
        }

        # Check for script updates
        Write-LogInfo "Checking for script updates..."
        $REMOTE_SCRIPT_URL = "https://raw.githubusercontent.com/algertc/ALPR-Database/$BRANCH/update.ps1"
        try {
            $REMOTE_VERSION = (Invoke-WebRequest -Uri $REMOTE_SCRIPT_URL -UseBasicParsing).Content | 
                            Select-String "SCRIPT_VERSION = (\d+)" | 
                            ForEach-Object { $_.Matches.Groups[1].Value }
            
            if ($REMOTE_VERSION -gt $SCRIPT_VERSION) {
                Write-LogInfo "A new version of the update script is available."
                Write-LogInfo "Downloading and executing new version..."
                Get-RemoteFile -Url $REMOTE_SCRIPT_URL -OutputFile "update_new.ps1"
                & .\update_new.ps1
                exit 0
            }
        }
        catch {
            Write-LogInfo "No script updates found."
        }

        # Verify required directories exist
        Write-LogInfo "Checking required directories..."
        @('auth', 'config', 'storage') | ForEach-Object {
            if (-not (Test-Path $_)) {
                New-Item -ItemType Directory -Path $_ | Out-Null
            }
        }
        Write-LogSuccess "Directory structure verified!"

        # Check for compose file updates
        Write-LogInfo "Checking for compose file updates..."
        $REMOTE_COMPOSE_URL = "https://raw.githubusercontent.com/algertc/ALPR-Database/$BRANCH/docker-compose.yml"
        
        if (Test-Path "docker-compose.yml") {
            # Download remote compose file
            Get-RemoteFile -Url $REMOTE_COMPOSE_URL -OutputFile "docker-compose.remote.yml"
            
            # Create normalized versions for comparison
            $local_normalized = Get-NormalizedCompose -FilePath "docker-compose.yml"
            $remote_normalized = Get-NormalizedCompose -FilePath "docker-compose.remote.yml"
            
            # Compare normalized content
            $diff = Compare-Object $local_normalized $remote_normalized
            
            if ($diff) {
                Write-LogWarning "Changes detected in docker-compose.yml"
                Write-Host "`nChanges:"
                $diff | ForEach-Object {
                    if ($_.SideIndicator -eq "<=") {
                        Write-Host "- $($_.InputObject)"
                    }
                    else {
                        Write-Host "+ $($_.InputObject)"
                    }
                }
                
                do {
                    $update_compose = Read-Host "`n${BOLD}Would you like to update your compose file? (y/n)${NC}"
                } while ($update_compose -notmatch '^[YyNn]$')
                
                if ($update_compose -match '^[Yy]$') {
                    # Get current configuration
                    $current_config = Get-Content "docker-compose.yml"
                    $ADMIN_PASSWORD = [regex]::Match($current_config, 'ADMIN_PASSWORD=(.*)').Groups[1].Value
                    $DB_PASSWORD = [regex]::Match($current_config, 'DB_PASSWORD=(.*)').Groups[1].Value
                    $TZ = [regex]::Match($current_config, 'TZ=(.*)').Groups[1].Value
                    $APP_PORT = [regex]::Match($current_config, '"(\d+):').Groups[1].Value
                    $DB_HOST = [regex]::Match($current_config, 'DB_HOST=(.*)').Groups[1].Value
                    
                    # Update remote compose file with current configuration
                    $new_compose = Get-Content "docker-compose.remote.yml"
                    $new_compose = $new_compose -replace ':latest', ":$IMAGE_TAG"
                    $new_compose = $new_compose -replace 'ADMIN_PASSWORD=.*', "ADMIN_PASSWORD=$ADMIN_PASSWORD"
                    $new_compose = $new_compose -replace 'DB_PASSWORD=.*', "DB_PASSWORD=$DB_PASSWORD"
                    $new_compose = $new_compose -replace 'POSTGRES_PASSWORD=.*', "POSTGRES_PASSWORD=$DB_PASSWORD"
                    $new_compose = $new_compose -replace 'TZ=.*', "TZ=$TZ"
                    $new_compose = $new_compose -replace '"3000:', """$APP_PORT:"
                    
                    if ($DB_HOST) {
                        $new_compose = $new_compose -replace '# DB_HOST=.*', "DB_HOST=$DB_HOST"
                    }
                    
                    $new_compose | Set-Content "docker-compose.yml"
                    Write-LogSuccess "Compose file updated successfully!"
                }
            }
            
            # Cleanup temporary files
            Remove-Item -Force "docker-compose.remote.yml" -ErrorAction SilentlyContinue
        }
        else {
            Write-LogError "No docker-compose.yml found in current directory!"
            exit 1
        }

        # Update migrations file
        Write-LogInfo "Updating migrations file..."
        Get-RemoteFile -Url "https://raw.githubusercontent.com/algertc/ALPR-Database/$BRANCH/migrations.sql" -OutputFile "migrations.sql"
        Write-LogSuccess "Migrations file updated!"

        # Stop running containers
        Write-LogInfo "Stopping running containers..."
        try {
            Invoke-DockerCompose "down"
        }
        catch {
            Write-LogError "Failed to stop containers: $_"
            exit 1
        }

        # Pull latest images
        Write-LogInfo "Pulling latest images..."
        try {
            Invoke-DockerCompose "pull"
        }
        catch {
            Write-LogError "Failed to pull latest images: $_"
            exit 1
        }

        # Start containers
        Write-LogInfo "Starting updated containers..."
        try {
            Invoke-DockerCompose "up -d"
        }
        catch {
            Write-LogError "Failed to start containers: $_"
            exit 1
        }

        Write-LogSuccess "Update completed successfully!"
    }
    
    '2' {
        Write-Host "`n${YELLOW}Restore functionality will be available in a future update.${NC}"
        exit 0
    }
}