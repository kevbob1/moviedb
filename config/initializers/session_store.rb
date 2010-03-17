# Be sure to restart your server when you modify this file.

# Your secret key for verifying cookie session data integrity.
# If you change this key, all old sessions will become invalid!
# Make sure the secret is at least 30 characters and all random, 
# no regular words or you'll be exposed to dictionary attacks.
ActionController::Base.session = {
  :key         => '_moviedb_session',
  :secret      => '3b1b9d2e2870a4a27459c5e225f37f7058becb3c5ee070a26b4c89ea2a0c4fa02d4fcb6c4a435ce32dd40223056baf7da93b0b0ca2eeb2de2c39c7ebb77fd7e9'
}

# Use the database for sessions instead of the cookie-based default,
# which shouldn't be used to store highly confidential information
# (create the session table with "rake db:sessions:create")
# ActionController::Base.session_store = :active_record_store
