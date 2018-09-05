FROM ruby:2.4-slim

# start setting up the app
ENV APP_HOME /myapp
RUN mkdir -p $APP_HOME
WORKDIR $APP_HOME

RUN set -x \
    && apt-get update  \
    && apt-get install -y \
       libpq-dev \
       build-essential \
       libv8-dev \
       postgresql-client \
       git \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/* /tmp/* /var/tmp/*

# Copy the Gemfile as well as the Gemfile.lock and install
# the RubyGems. This is a separate step so the dependencies
# will be cached unless changes to one of those two files
# are made.
CMD puma -C config/puma.rb
COPY Gemfile Gemfile.lock ./
RUN gem install bundler && bundle install -j "$(getconf _NPROCESSORS_ONLN)" --retry 5 --without development test

EXPOSE 3000
ENV RAILS_ENV production
ENV RAILS_SERVE_STATIC_FILES 1
ENV SECRET_KEY_BASE 11c6e318ae5a254d7c41923d1518801d77ef3084cbe2d59c259e3bd1f01816fe64547f76ddd39df3ba55bb5afc5575326b676c69535828251d3ec1a49a65ce0a
ADD . $APP_HOME
RUN cd $APP_HOME
RUN rake assets:precompile

