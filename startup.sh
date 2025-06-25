#!/bin/bash

# This script is used to start the Django application in a container.

create_admin_user() {
error_output=$(python3 manage.py createsuperuser --noinput 2>&1)
exit_code=$?
if [ $exit_code -ne 0 ]; then
    if [[ $error_output == *"username is already taken"* ]]; then
        echo "Superuser already exists, skipping creation."
        return 0
    else
        echo "Error creating superuser: $error_output"
        return $exit_code
    fi
fi
}


pip3 install -r requirements.txt && \
python3 manage.py makemigrations && python3 manage.py migrate && \
create_admin_user && \
python3 manage.py collectstatic --noinput && gunicorn --workers 2 main.wsgi