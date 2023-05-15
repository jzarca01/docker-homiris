docker run -d --name homiris --restart=unless-stopped --log-driver json-file --log-opt max-size=10m --log-opt max-file=5 --env-file .env homiris
