# README

This README would normally document whatever steps are necessary to get the
application up and running.

Things you may want to cover:

* Ruby version

* System dependencies

* Configuration

* Database creation

* Database initialization

## Development

### Running the Test Suite
All commands should be executed via the `devcontainer` CLI.

1.  **Build Assets (Required for RSpec)**
    If you encounter errors regarding `tailwind.css` missing in the asset pipeline, run:
    ```bash
    devcontainer exec bundle exec rake tailwindcss:build
    ```

2.  **Run RSpec**
    ```bash
    devcontainer exec bundle exec rspec
    ```


* Services (job queues, cache servers, search engines, etc.)

* Deployment instructions

* ...
