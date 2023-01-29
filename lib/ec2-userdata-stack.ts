import * as cdk from "aws-cdk-lib";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import { Construct } from "constructs";
// import * as sqs from 'aws-cdk-lib/aws-sqs';
import * as iam from "aws-cdk-lib/aws-iam";

export class Ec2UserdataStack extends cdk.Stack {
	constructor(scope: Construct, id: string, props?: cdk.StackProps) {
		super(scope, id, props);

		const vpc = new ec2.Vpc(this, "vpc", {
			subnetConfiguration: [
				{
					cidrMask: 24,
					name: "Public",
					subnetType: ec2.SubnetType.PUBLIC,
				},
			],
		});

		const logicalResourceId = "instance";
		const shebang = `#!/bin/bash
    /opt/aws/bin/cfn-init -v --stack \${AWS::StackName} --resource ${logicalResourceId} --region \${AWS::Region}
    /opt/aws/bin/cfn-signal -e $? --stack \${AWS::StackName} --resource ${logicalResourceId}--region \${AWS::Region}`;
		5;
		// Startup CFN hup
		// Configure CFN hup -
		// Install software

		// Test
		// Fingerprint should not update
		// All config sets should be updated on configuration
		const cfnHupRestartHandle = new ec2.InitServiceRestartHandle();
		const cloudwatchAgentRestartHandle = new ec2.InitServiceRestartHandle();

		const cfnHupService = ec2.InitService.enable("cfn-hup", {
			enabled: true,
			ensureRunning: true,
			serviceRestartHandle: cfnHupRestartHandle,
		});

		const configKeys = ["configureCfnHupService", "configureCloudwatchAgent"];
		const instance = new ec2.Instance(this, logicalResourceId, {
			initOptions: {
				printLog: true,
				embedFingerprint: false,
			},
			init: ec2.CloudFormationInit.fromConfigSets({
				configs: {
					configureCfnHupService: new ec2.InitConfig([
						cfnHupService,
						ec2.InitFile.fromString(
							"/etc/cfn/cfn-hup.conf",
							`[main]
stack=${this.stackName}
region=${this.region}
interval=5`,
							{
								group: "root",
								mode: "000400",
								owner: "root",
								serviceRestartHandles: [cfnHupRestartHandle],
							},
						),
						...configKeys.map((configKeys) =>
							ec2.InitFile.fromString(
								`/etc/cfn/hooks.d/${configKeys}.conf`,
								`[${configKeys}-hook]
triggers=post.update
path=Resources.${logicalResourceId}.Metadata.AWS::CloudFormation::Init
action=/opt/aws/bin/cfn-init -v --stack ${this.stackName} --resource ${logicalResourceId} --configsets ${configKeys} --region ${this.region}
`,
								{
									group: "root",
									mode: "000400",
									owner: "root",
									serviceRestartHandles: [cfnHupRestartHandle],
								},
							),
						),
					]),
					configureCloudwatchAgent: new ec2.InitConfig([
						ec2.InitPackage.yum("amazon-cloudwatch-agent"),
						ec2.InitFile.fromString(
							"/opt/aws/amazon-cloudwatch-agent/amazon-cloudwatch-agent-config.json",
							JSON.stringify({
								agent: {
									metrics_collection_interval: 10,
									logfile:
										"/opt/aws/amazon-cloudwatch-agent/logs/amazon-cloudwatch-agent.log",
								},
								metrics: {
									namespace: "MyCustomNamespace",
									metrics_collected: {
										cpu: {
											resources: ["*"],
											measurement: [
												{
													name: "cpu_usage_idle",
													rename: "CPU_USAGE_IDLE",
													unit: "Percent",
												},
												{ name: "cpu_usage_nice", unit: "Percent" },
												"cpu_usage_guest",
											],
											totalcpu: false,
											metrics_collection_interval: 10,
											append_dimensions: {
												customized_dimension_key_1:
													"customized_dimension_value_1",
												customized_dimension_key_2:
													"customized_dimension_value_2",
											},
										},
										disk: {
											resources: ["/", "/tmp"],
											measurement: [
												{
													name: "free",
													rename: "DISK_FREE",
													unit: "Gigabytes",
												},
												"total",
												"used",
											],
											ignore_file_system_types: ["sysfs", "devtmpfs"],
											metrics_collection_interval: 60,
											append_dimensions: {
												customized_dimension_key_3:
													"customized_dimension_value_3",
												customized_dimension_key_4:
													"customized_dimension_value_4",
											},
										},
										diskio: {
											resources: ["*"],
											measurement: [
												"reads",
												"writes",
												"read_time",
												"write_time",
												"io_time",
											],
											metrics_collection_interval: 60,
										},
										swap: {
											measurement: [
												"swap_used",
												"swap_free",
												"swap_used_percent",
											],
										},
										mem: {
											measurement: ["mem_used", "mem_cached", "mem_total"],
											metrics_collection_interval: 1,
										},
										net: {
											resources: ["eth0"],
											measurement: [
												"bytes_sent",
												"bytes_recv",
												"drop_in",
												"drop_out",
											],
										},
										netstat: {
											measurement: [
												"tcp_established",
												"tcp_syn_sent",
												"tcp_close",
											],
											metrics_collection_interval: 60,
										},
										processes: {
											measurement: ["running", "sleeping", "dead"],
										},
									},
									append_dimensions: {
										ImageId: "${aws:ImageId}",
										InstanceId: "${aws:InstanceId}",
										InstanceType: "${aws:InstanceType}",
										AutoScalingGroupName: "${aws:AutoScalingGroupName}",
									},
									aggregation_dimensions: [
										["ImageId"],
										["InstanceId", "InstanceType"],
										["d1"],
										[],
									],
									force_flush_interval: 30,
								},
								logs: {
									logs_collected: {
										files: {
											collect_list: [
												{
													file_path:
														"/opt/aws/amazon-cloudwatch-agent/logs/amazon-cloudwatch-agent.log",
													log_group_name: `/aws/ec2/${this.stackName}/cloudwatch-agent`,
													log_stream_name: `/aws/ec2/${this.stackName}/cloudwatch-agent`,
													timezone: "Local",
												},
												{
													file_path: "/var/log/cfn-init.log",
													log_group_name: `/aws/ec2/${this.stackName}/cfn-init`,
													log_stream_name: `/aws/ec2/${this.stackName}/cfn-init`,
													timezone: "Local",
												},
												{
													file_path: "/var/log/cfn-hup.log",
													log_group_name: `/aws/ec2/${this.stackName}/cfn-hup`,
													log_stream_name: `/aws/ec2/${this.stackName}/cfn-hup`,
													timezone: "Local",
												},
											],
										},
									},
									log_stream_name: this.stackName,
									force_flush_interval: 15,
								},
							}),
							{ serviceRestartHandles: [cloudwatchAgentRestartHandle] },
						),
						ec2.InitCommand.shellCommand(
							`/opt/aws/amazon-cloudwatch-agent/bin/amazon-cloudwatch-agent-ctl -a fetch-config -m ec2 -s -c file:/opt/aws/amazon-cloudwatch-agent/amazon-cloudwatch-agent-config.json`,
						),
					]),
				},
				configSets: {
					default: ["configureCfnHupService", "configureCloudwatchAgent"],
					configureCfnHupService: ["configureCfnHupService"],
					configureCloudwatchAgent: ["configureCloudwatchAgent"],

					// default: ["configureCfnHupService", "configureCfnHupHooks"],
					// configureCfnHupHooks: ["configureCfnHupHooks"],
				},
			}),
			instanceType: ec2.InstanceType.of(
				ec2.InstanceClass.T3,
				ec2.InstanceSize.MICRO,
			),
			machineImage: new ec2.AmazonLinuxImage({
				generation: ec2.AmazonLinuxGeneration.AMAZON_LINUX_2,
				cpuType: ec2.AmazonLinuxCpuType.X86_64,
			}),
			userDataCausesReplacement: false,
			userData: ec2.UserData.forLinux({
				shebang,
			}),
			vpc,
		});

		instance.instance.overrideLogicalId(logicalResourceId);
		instance.role.addManagedPolicy(
			iam.ManagedPolicy.fromAwsManagedPolicyName(
				"AmazonSSMManagedInstanceCore",
			),
		);
		instance.role.addManagedPolicy(
			iam.ManagedPolicy.fromAwsManagedPolicyName("CloudWatchAgentServerPolicy"),
		);
	}
}
