#!/bin/bash
set -e

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" <<-EOSQL
    CREATE DATABASE moviedb_development;
    CREATE DATABASE moviedb_test;
    CREATE DATABASE moviedb_production;
EOSQL
