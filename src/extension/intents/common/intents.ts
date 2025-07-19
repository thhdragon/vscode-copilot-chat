/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { defaultAgentName, editingSessionAgent2Name, editingSessionAgentName, editorAgentName, editsAgentName, getChatParticipantNameFromId, terminalAgentName, vscodeAgentName, workspaceAgentName } from '../../../platform/chat/common/chatAgents';

/**
 * Create a mode name for gh telemetry
 */
export function participantIdToModeName(participantId: string): string {
	const name = getChatParticipantNameFromId(participantId);

	switch (name) {
		case defaultAgentName:
		case workspaceAgentName:
		case vscodeAgentName:
		case 'terminalPanel':
			return 'ask';
		case editsAgentName:
			return 'agent';
		case editingSessionAgentName:
		case editingSessionAgent2Name:
			return 'edit';
		case editorAgentName:
		case terminalAgentName: // Count terminal and "etc" as 'inline'
		default:
			return 'inline';
	}
}