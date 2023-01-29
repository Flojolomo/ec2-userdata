# EC2 User Data

Features
* EC2 instance is initialized once, when launched the first time
* All configs are observed with cfn-hup and updates are applied accordingly
* Cloudwatch agent is installed to send metrics and logs to cloudwatch