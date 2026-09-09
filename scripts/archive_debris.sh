#!/usr/bin/env bash
# script to safely archive root debris
export GIT_CONFIG_GLOBAL=/dev/null
export GIT_CONFIG_SYSTEM=/dev/null


mkdir -p _archive/scripts
mkdir -p _archive/reports
mkdir -p _archive/data_dumps

# Move all untracked files (excluding .agents, .workflow, etc. and db.sqlite)
git ls-files --others --exclude-standard | while read -r file; do
  # Skip if it's not in the root directory (contains a slash)
  if [[ "$file" == */* ]]; then
    continue
  fi
  
  # Skip specific files
  if [[ "$file" == "db.sqlite" || "$file" == "db.sqlite-journal" || "$file" == "db.sqlite-wal" || "$file" == "db.sqlite-shm" ]]; then
    continue
  fi

  # Skip governance/validation files we just created in root (if any)
  if [[ "$file" == "tsc_output.txt" || "$file" == "build_output.txt" ]]; then
    mv "$file" _archive/data_dumps/
    continue
  fi

  # Classify by extension/pattern
  if [[ "$file" == *.ts || "$file" == *.js ]]; then
    mv "$file" _archive/scripts/
  elif [[ "$file" == *.md || "$file" == *.txt || "$file" == *.log ]]; then
    mv "$file" _archive/reports/
  elif [[ "$file" == *.json || "$file" == *.html || "$file" == *.png || "$file" == *.csv ]]; then
    mv "$file" _archive/data_dumps/
  else
    # default fallback
    mv "$file" _archive/
  fi
done

# Finally, gitignore the archive directory
echo "_archive/" >> .gitignore
