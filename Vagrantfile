# -*- mode: ruby -*-
# vi: set ft=ruby :


# All Vagrant configuration is done below. The "2" in Vagrant.configure
# configures the configuration version (we support older styles for
# backwards compatibility). Please don't change it unless you know what
# you're doing.
Vagrant.configure("2") do |config|
  # The most common configuration options are documented and commented below.
  # For a complete reference, please see the online documentation at
  # https://docs.vagrantup.com.

  config.vm.network :private_network, type: "dhcp"

    config.ssh.username = "root"
    config.vm.allow_fstab_modification = false
    config.vm.provider "docker" do |d|
      d.image = "kevbob/docker-vagrant:noble-1.0.2-1"
      d.has_ssh = true
      d.remains_running = true
      d.name = "moviedb"
    end
    config.ssh.extra_args = [ "-t", "cd /vagrant; bash --login" ]
    config.vm.network "forwarded_port", guest: 3000, host: 3000
    config.vm.network "forwarded_port", guest: 5432, host: 5432

    config.vm.provision "shell", privileged: false, inline: <<-SHELL
      #os
      apt-get update
      apt-get install -y \
        git curl \
        libssl-dev \
        libreadline-dev \
        zlib1g-dev \
        autoconf \
        bison \
        build-essential \
        libyaml-dev \
        libreadline-dev libncurses5-dev libffi-dev libgdbm-dev \
        iputils-ping \
        libpq-dev \
        sudo \
        postgresql

      cd ~/

      # start postgresql
      /etc/init.d/postgresql start
      # create db user with superuser and createdb privileges
      # this is needed for the rails app to run
      sudo -u postgres createuser -s -d moviedb

      # set password for db user
      sudo -u postgres psql -U postgres postgres -c "ALTER USER moviedb PASSWORD 'new_password';"

      # install rbenv
      curl -fsSL https://github.com/rbenv/rbenv-installer/raw/HEAD/bin/rbenv-installer | bash

      # install nvm
      curl -fsSL https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.2/install.sh | bash

      # Source .bashrc to load rbenv/nvm into the current shell session
      source ~/.bashrc

      # install ruby using .ruby-version
      rbenv install

      # install ruby bundles
      bundle install

      # install node using .nvmrc
      nvm install

      corepack enable
      corepack prepare yarn@4.9.1 --activate
      yarn install

    SHELL
end
