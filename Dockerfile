FROM ruby_baseimage:2.2

# Use baseimage-docker's init system.
CMD ["/sbin/my_init"]

# os dependencies
RUN apt-get update -qq \
    && apt-get install -y haproxy \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/* /tmp/* /var/tmp/*

# start setting up the app
ENV APP_HOME /myapp
RUN mkdir -p $APP_HOME
WORKDIR $APP_HOME

ADD Gemfile* $APP_HOME/
RUN bundle install
ADD . $APP_HOME


EXPOSE 3000