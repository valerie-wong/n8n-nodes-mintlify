import {
	IExecuteFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
	NodeOperationError,
} from 'n8n-workflow';export class Mintlify implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Mintlify',
		name: 'mintlify',
		icon: 'file:mintlify.svg',
		group: ['transform'],
		version: 1,
		description: 'Update documentation with Mintlify AI Agent',
		defaults: {
			name: 'Mintlify',
		},
		inputs: ['main'],
		outputs: ['main'],
		credentials: [
			{
			name: 'mintlifyApi',
			required: true,
			},
		],
		properties: [
		{
			displayName: 'Operation',
			name: 'operation',
			type: 'options',
			noDataExpression: true,
			options: [
				{	name: 'Update Documentation',
					value: 'updateDocs',
					description: 'Create or update documentation using the Mintlify AI agent',
					action: 'Update documentation',
				},
				{
					name: 'Get Agent Job',
					value: 'getJob',
					description: 'Get the status and details of an agent job',
					action: 'Get agent job status',
				},
				{
					name: 'Custom Request',
					value: 'customRequest',
					description: 'Make a custom API request to any Mintlify endpoint',
					action: 'Make custom request',
				},
			],
			default: 'updateDocs',
		},
		{
			displayName: 'Branch Name',
			name: 'branch',
			type: 'string',
			displayOptions: {
				show: {
					operation: ['updateDocs'],
				},
			},
			default: 'main',
			required: true,
			description: 'Git branch',
			placeholder: 'main',
		},
		{
			displayName: 'Instructions',
			name: 'prompt',
			type: 'string',
			displayOptions: {
				show: {operation: ['updateDocs'],},
			},
			typeOptions: {rows: 5,},
			default: '',
			required: true,
			placeholder: '',
			description: 'Tell the Mintlify agent what documentation changes to make',
		},
		{
			displayName: 'Job ID',
			name: 'jobId',
			type: 'string',
			displayOptions: {
				show: {
					operation: ['getJob'],

				},
			},
			default: '',
			required: true,
			placeholder: 'sess_...',
			description: 'The job ID returned from the Update Documentation operation',
		},
		{
			displayName: 'HTTP Method',
			name: 'method',
			type: 'options',
			displayOptions: {
				show: {
					operation: ['customRequest'],
				},
			},
			options: [
				{ name: 'DELETE', value: 'DELETE' },
				{ name: 'GET', value: 'GET' },
				{ name: 'PATCH', value: 'PATCH' },
				{ name: 'POST', value: 'POST' },
				{ name: 'PUT', value: 'PUT' },
			],
			default: 'GET',
			required: true,
		},
		{
			displayName: 'Endpoint',
			name: 'endpoint',
			type: 'string',
			displayOptions: {
			show: {
				operation: ['customRequest'],
			},
			},
			default: '/agent/{{$credentials.projectId}}/jobs',
			required: true,
			placeholder: '/agent/{{$credentials.projectId}}/job/123',
			description: 'The API endpoint path (without base URL). Use {{$credentials.projectId}} for your project ID.',
		},
		{
			displayName: 'Send Body',
			name: 'sendBody',
			type: 'boolean',
			displayOptions: {
				show: {
					operation: ['customRequest'],
					method: ['POST', 'PUT', 'PATCH'],
				},
			},
			default: false,
			description: 'Whether to send a request body',
		},
		{
			displayName: 'Body',
			name: 'body',
			type: 'json',
			displayOptions: {
				show: {
					operation: ['customRequest'],
					sendBody: [true],
				},
			},
			default: '{\n  "key": "value"\n}',
			description: 'JSON body to send with the request',
		},
		{
			displayName: 'Query Parameters',
			name: 'queryParameters',
			type: 'fixedCollection',
			displayOptions: {
				show: {
					operation: ['customRequest'],
				},
			},
			placeholder: 'Add Parameter',
			default: {},
			typeOptions: {
					multipleValues: true,
			},
			options: [
				{
					name: 'parameter',
					displayName: 'Parameter',
					values: [
						{
							displayName: 'Name',
							name: 'name',
							type: 'string',
							default: '',
						},
						{
							displayName: 'Value',
							name: 'value',
							type: 'string',
							default: '',
						},
					],
				},
			],
		},
		],
};

async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
	const items = this.getInputData();
	const returnData: INodeExecutionData[] = [];
	const operation = this.getNodeParameter('operation', 0);
	for (let i = 0; i < items.length; i++) {
		try {
			const credentials = await this.getCredentials('mintlifyApi', i);

			if (operation === 'updateDocs') {
				const branch = this.getNodeParameter('branch', i) as string;
				const prompt = this.getNodeParameter('prompt', i) as string;
				const body = {
					branch,
					messages: [
						{ role: 'user', content: prompt },
					],
				};
				const response = await this.helpers.httpRequestWithAuthentication.call(
					this,
					'mintlifyApi',
					{
						method: 'POST',
						url: `https://api.mintlify.com/v1/agent/${credentials.projectId}/job`,
						body,
						json: true,
						returnFullResponse: true,
					},
				);
				const jobId = response.headers['x-session-id'];
				returnData.push({
				json: {
					success: true,
					jobId: jobId,
					branch,
					prompt,
					status: 'created',
				},
				pairedItem: { item: i },
			});
		}
		else if (operation === 'getJob') {
			const jobId = this.getNodeParameter('jobId', i) as string;
			const response = await this.helpers.httpRequestWithAuthentication.call(
				this,
				'mintlifyApi',
			{
				method: 'GET',
				url: `https://api.mintlify.com/v1/agent/${credentials.projectId}/job/${jobId}`,
				json: true,
			},
		);
		returnData.push({
			json: response,
			pairedItem: { item: i },
		});
			}
			else if (operation === 'customRequest') {
				const method = this.getNodeParameter('method', i) as string;
				let endpoint = this.getNodeParameter('endpoint', i) as string;
				const sendBody = this.getNodeParameter('sendBody', i, false) as boolean;
				const queryParameters = this.getNodeParameter('queryParameters.parameter', i, []) as Array<{name: string, value: string}>;
				endpoint = endpoint.replace('{{$credentials.projectId}}', credentials.projectId as string);
				const qs: Record<string, string> = {};
				for (const param of queryParameters) {
					if (param.name) {
						qs[param.name] = param.value;
					}
				}
				const requestOptions: any = {
					method,
					url: `https://api.mintlify.com/v1${endpoint}`,
					qs,
					json: true,
					returnFullResponse: true,
				};
				if (sendBody && ['POST', 'PUT', 'PATCH'].includes(method)) {
					const bodyString = this.getNodeParameter('body', i) as string;
					try {
						requestOptions.body = JSON.parse(bodyString);
					} catch (error) {
						throw new NodeOperationError(
						this.getNode(),
						'Invalid JSON in body parameter',
						{ itemIndex: i }
						);
					}
				}
				const response = await this.helpers.httpRequestWithAuthentication.call(
					this,
					'mintlifyApi',
					requestOptions,
				);
				returnData.push({
						json: {
							statusCode: response.statusCode,
							headers: response.headers,
							body: response.body,
						},
					pairedItem: { item: i },
				});
			}
		} catch (error) {
			const errorMessage = error.message || 'Unknown error';
			const errorCode = error.code;
			const errorResponse = error.response?.data;
			console.error('Mintlify node error:', {
				message: errorMessage,
				code: errorCode,
				itemIndex: i,
				response: errorResponse,
				stack: error.stack,
			});
			if (errorMessage.includes('aborted') || errorCode === 'ECONNRESET') {
				const streamError = new NodeOperationError(
					this.getNode(),
					`Request was aborted. This may be due to timeout or network issues. Try: 1) Increasing timeout settings, 2) Checking network connection, 3) Verifying Mintlify API status`,
					{
						itemIndex: i,
						description: 'Stream aborted',
					}
				);

				if (this.continueOnFail()) {
					returnData.push({
						json: {
							error: errorMessage,
							errorType: 'STREAM_ABORTED',
							code: errorCode,
							itemIndex: i,
							suggestion: 'Consider increasing timeout or retrying',
						},
						pairedItem: { item: i },
					});
					continue;
				}
				throw streamError;
			}
			if (errorCode === 'ETIMEDOUT' || errorMessage.includes('timeout')) {
				if (this.continueOnFail()) {
					returnData.push({
						json: {
							error: 'Request timed out',
							errorType: 'TIMEOUT',
							itemIndex: i,
						},
						pairedItem: { item: i },
					});
					continue;
				}
				throw new NodeOperationError(
					this.getNode(),
					'Request timed out. Consider increasing the timeout setting.',
					{ itemIndex: i }
				);
			}
			if (error.response) {
				const statusCode = error.response.status;
				const apiError = new NodeOperationError(
					this.getNode(),
					`Mintlify API error (${statusCode}): ${errorResponse || errorMessage}`,
					{
						itemIndex: i,
						description: `HTTP ${statusCode}`,
					}
				);
				if (this.continueOnFail()) {
					returnData.push({
						json: {
							error: errorMessage,
							errorType: 'API_ERROR',
							statusCode,
							response: errorResponse,
							itemIndex: i,
						},
						pairedItem: { item: i },
					});
					continue;
				}
				throw apiError;
			}
			if (this.continueOnFail()) {
				returnData.push({
					json: {
						error: errorMessage,
						errorType: 'UNKNOWN',
						code: errorCode,
						itemIndex: i,
					},
					pairedItem: { item: i },
				});
				continue;
			}

			throw new NodeOperationError(this.getNode(), error as Error, {
				itemIndex: i,
			});
		}
	}
	return [returnData];
	}
}
