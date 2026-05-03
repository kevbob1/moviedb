# Puma configuration file
# Bind to all interfaces so the Rails server is accessible from the host
# through devcontainer port forwarding.

threads_count = ENV.fetch("RAILS_MAX_THREADS", 5)
threads threads_count, threads_count

bind "tcp://0.0.0.0:#{ENV.fetch('PORT', 3000)}"

environment ENV.fetch("RAILS_ENV", "development")

pidfile ENV.fetch("PIDFILE", "tmp/pids/server.pid")

workers 0
