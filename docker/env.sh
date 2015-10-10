#!/bin/bash
# Docker doesn't have a great way to set runtime environment variables,
# so use this script to prepare the execution environnment for later processes.
export SQLALCHEMY_DATABASE_URI="postgresql://${DB_PORT_5432_TCP_ADDR}:5432/database_name"

# Execute the commands passed to this script
# e.g. "./env.sh venv/bin/nosetests --with-xunit
exec "$@"
