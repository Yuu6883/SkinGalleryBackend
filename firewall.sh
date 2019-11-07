#!/bin/sh

iptables -F

iptables -A INPUT -m state --state RELATED,ESTABLISHED -j ACCEPT

iptables -A INPUT   -i lo -j ACCEPT;
iptables -A OUTPUT  -o lo -j ACCEPT;

iptables -A INPUT   -p tcp --dport ssh -j ACCEPT;

for ip in `curl https://www.cloudflare.com/ips-v4`; do iptables  -A INPUT -p tcp -s $ip --dport http -j ACCEPT; done

for ip in `curl https://www.cloudflare.com/ips-v6`; do ip6tables -A INPUT -p tcp -s $ip --dport http -j ACCEPT; done

iptables -A INPUT   -j DROP;