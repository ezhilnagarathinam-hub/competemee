#!/bin/sh
# Replace importer@local with correct name/email for commit author/committer
OLD_EMAIL="importer@local"
CORRECT_NAME="Ezhil Nagarathinam"
CORRECT_EMAIL="ezhilnagarathinam@gmail.com"

if [ "$GIT_COMMITTER_EMAIL" = "$OLD_EMAIL" ]; then
  export GIT_COMMITTER_NAME="$CORRECT_NAME"
  export GIT_COMMITTER_EMAIL="$CORRECT_EMAIL"
fi
if [ "$GIT_AUTHOR_EMAIL" = "$OLD_EMAIL" ]; then
  export GIT_AUTHOR_NAME="$CORRECT_NAME"
  export GIT_AUTHOR_EMAIL="$CORRECT_EMAIL"
fi
