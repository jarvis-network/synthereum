FROM python:3.6.6

RUN groupadd -r keeper && useradd --no-log-init -r -g keeper keeper

COPY bin /opt/keeper/synfiat-keeper/bin
COPY lib /opt/keeper/synfiat-keeper/lib
COPY install.sh /opt/keeper/synfiat-keeper/install.sh
COPY requirements.txt /opt/keeper/synfiat-keeper/requirements.txt

WORKDIR /opt/keeper/synfiat-keeper
RUN pip3 install virtualenv
RUN ./install.sh

COPY config /opt/keeper/synfiat-keeper/config
COPY synfiat_keeper /opt/keeper/synfiat-keeper/synfiat_keeper

WORKDIR /opt/keeper/synfiat-keeper/bin

USER keeper
