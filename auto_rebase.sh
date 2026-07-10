#!/bin/bash
while git status | grep -q "rebase in progress"; do
  echo "--- Running rebase step ---"
  
  # Check if there are conflicts
  if git status | grep -q "Unmerged paths:"; then
    echo "Found conflicts. Accepting incoming (--theirs)..."
    git checkout --theirs .
    git add .
  fi

  # Continue the rebase without an editor prompt
  if ! GIT_EDITOR=true git rebase --continue; then
    # If it failed, it might be due to an empty patch. Let's check status.
    STATUS=$(git status)
    if echo "$STATUS" | grep -q "no changes added to commit" || echo "$STATUS" | grep -q "all conflicts fixed: run \\\"git rebase --continue\\\"" ; then
        echo "Continuing failed. Trying to skip empty patch..."
        # Wait, if all conflicts fixed, maybe git rebase --continue failed because of empty commit?
        # A common failure for git rebase --continue when there are no changes is "The previous cherry-pick is now empty".
        git rebase --skip
    elif echo "$STATUS" | grep -q "Unmerged paths:"; then
        echo "Still have conflicts? Continuing loop."
    else
        echo "Unknown error during rebase. Breaking."
        break
    fi
  fi
done
echo "Rebase complete!"
