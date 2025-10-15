import {IAuthenticateGeneric, ICredentialTestRequest, ICredentialType, INodeProperties} from 'n8n-workflow';

export class MintlifyApi implements ICredentialType {
    name = 'mintlifyApi';
    displayName = 'Mintlify API';
		documentationUrl = 'https://www.mintlify.com/docs';
    properties: INodeProperties[] = [
        {
            displayName: 'Admin API Key',
            name: 'apiKey',
            type: 'string',
            typeOptions: {password: true,},
            default: '',
            required: true,
            description: 'Get your API key from the settings page of your Mintlify Dashboard',
        },
        {
            displayName: 'Project ID',
            name: 'projectId',
            type: 'string',
            default: '',
            required: true,
            description: 'Get your Project ID from the settings page of your Mintlify Dashboard',
        },
    ];

    authenticate: IAuthenticateGeneric = {
        type: 'generic',
        properties: {
            headers: {
                Authorization: '=Bearer {{$credentials.apiKey}}',
            },
        },
    };

    test: ICredentialTestRequest = {
        request: {
            baseURL: '=https://api.mintlify.com/v1/agent/{{$credentials.projectId}}',
            url: '/job',
            method: 'POST',
            body: {
                branch: 'test',
                messages: [
                    {
                        role: 'user',
                        content: 'test',
                    },
                ],
            },
        },
    };
}
