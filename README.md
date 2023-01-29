# EC2 User Data

The purpose of this project is to evaluated EC2 user data to initialize an EC2 instance so that it can be updated without being restarted.
That has been achieved and besides that, the cloudwatch agent has been integrated to pipe metrics and logs to cloudwatch.

Features
* EC2 instance is initialized once, when launched the first time
* All configs are observed with cfn-hup and updates are applied accordingly
* Cloudwatch agent is installed to send metrics and logs to cloudwatch