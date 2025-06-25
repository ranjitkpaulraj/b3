'''
This script is used to set up the environment for a Django application.
'''

import os
import json

# This is a workaround for the mysqlclient library, which is not compatible with some containers.
# It allows us to use pymysql as a drop-in replacement for MySQLdb.
import pymysql
pymysql.install_as_MySQLdb()

from dotenv import load_dotenv
load_dotenv()

def parse_json_vars():

    # Load json formatted database credentials from environment variable
    # and set them as regular environment variables.
    # This is necessary when using AWS App Runner, as it does not support
    # passing JSON formatted environment variables directly.
    # The credentials are expected to be in the format:
    # {"username": "your_username", "password": "your_password"}

    db_cred = os.getenv('DB_CRED')
    print(db_cred)
    if db_cred:
        try:
            db_cred = json.loads(db_cred)
            os.environ['DB_USER'] = db_cred.get('username')
            os.environ['DB_PASSWORD'] = db_cred.get('password')
        except json.JSONDecodeError as e:
            print(f"Error decoding DB credential JSON: {e}")
            exit(1)

    # Load json formatted Django parameters from environment variable
    # and set them as regular environment variables.
    django_params = os.getenv('DJANGO_PARAMS')
    print(f"Django params: {django_params}")
    if django_params:
        try:
            django_params = json.loads(django_params)
            for key, value in django_params.items():
                os.environ[key] = value
        except json.JSONDecodeError as e:
            print(f"Error decoding Django parameters JSON: {e}")
            exit(1)





