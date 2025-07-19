/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { lm } from 'vscode';
import { IAuthenticationService } from '../../../platform/authentication/common/authentication';
import { ConfigKey, IConfigurationService } from '../../../platform/configuration/common/configurationService';
import { ICAPIClientService } from '../../../platform/endpoint/common/capiClient';
import { IVSCodeExtensionContext } from '../../../platform/extContext/common/extensionContext';
import { ILogService } from '../../../platform/log/common/logService';
import { IFetcherService } from '../../../platform/networking/common/fetcherService';
import { Disposable } from '../../../util/vs/base/common/lifecycle';
import { IInstantiationService } from '../../../util/vs/platform/instantiation/common/instantiation';
import { BYOKKnownModels, isBYOKEnabled } from '../../byok/common/byokProvider';
import { IExtensionContribution } from '../../common/contributions';
import { AnthropicLMProvider } from './anthropicProvider';
import { BYOKStorageService, IBYOKStorageService } from './byokStorageService';
import { BYOKUIService, ModelConfig } from './byokUIService';
import { CerebrasModelRegistry } from './cerebrasProvider';
import { CustomOpenAIProvider } from './customOpenAIProvider';
import { GeminiBYOKModelRegistry } from './geminiProvider';
import { GroqModelRegistry } from './groqProvider';
import { OllamaModelRegistry } from './ollamaProvider';
import { OpenRouterBYOKModelRegistry } from './openRouterProvider';

export class BYOKContrib extends Disposable implements IExtensionContribution {
	public readonly id: string = 'byok-contribution';
	private readonly _byokStorageService: IBYOKStorageService;

	constructor(
		@IFetcherService private readonly _fetcherService: IFetcherService,
		@ILogService private readonly _logService: ILogService,
		@IConfigurationService private readonly _configurationService: IConfigurationService,
		@ICAPIClientService private readonly _capiClientService: ICAPIClientService,
		@IVSCodeExtensionContext extensionContext: IVSCodeExtensionContext,
		@IAuthenticationService authService: IAuthenticationService,
		@IInstantiationService private readonly _instantiationService: IInstantiationService,
	) {
		super();
		this._logService.logger.info(`BYOK: BYOKContrib constructor called`);
		this._byokStorageService = new BYOKStorageService(extensionContext);
		this._logService.logger.info(`BYOK: Calling initial _authChange`);
		this._authChange(authService, instantiationService);

		this._register(authService.onDidAuthenticationChange(() => {
			this._logService.logger.info(`BYOK: Auth status changed, calling _authChange`);
			this._authChange(authService, instantiationService);
		}));

		this._register(window.onDidChangeWindowState((e) => {
			if (e.focused) {
				this.restoreModels();
			}
		}));

		this._logService.logger.info(`BYOK: Registering github.copilot.chat.manageModels command`);
		this._register(commands.registerCommand('github.copilot.chat.manageModels', () => this.registerModelCommand()));
	}

	private async _authChange(authService: IAuthenticationService, instantiationService: IInstantiationService) {
		this._logService.logger.info(`BYOK: _authChange called`);
		this._modelRegistries = [];
		if (authService.copilotToken?.isInternal) {
			this.testLargeTelemetryPayload();
		}

		if (authService.copilotToken && isBYOKEnabled(authService.copilotToken, this._capiClientService)) {
			this._logService.logger.info(`BYOK: BYOK is enabled, registering model providers`);
			// These are intentionally registered in alphabetical order so we don't need to sort them later.
			// They will be shown to the user in the same order.
			this._modelRegistries.push(instantiationService.createInstance(AnthropicBYOKModelRegistry));
			this._modelRegistries.push(instantiationService.createInstance(AzureBYOKModelRegistry));
			if (authService.copilotToken.isInternal) {
				this._modelRegistries.push(instantiationService.createInstance(CerebrasModelRegistry));
			}
			this._modelRegistries.push(instantiationService.createInstance(CustomOpenAIProvider));
			this._logService.logger.info(`BYOK: CustomOpenAIProvider registered`);
			this._modelRegistries.push(instantiationService.createInstance(GeminiBYOKModelRegistry));
			this._modelRegistries.push(instantiationService.createInstance(GroqModelRegistry));
			this._modelRegistries.push(instantiationService.createInstance(OAIBYOKModelRegistry));
			this._modelRegistries.push(instantiationService.createInstance(OllamaModelRegistry, this._configurationService.getConfig(ConfigKey.OllamaEndpoint)));
			this._modelRegistries.push(instantiationService.createInstance(OpenRouterBYOKModelRegistry));
			this._logService.logger.info(`BYOK: Total ${this._modelRegistries.length} model registries created`);
			// Update known models list from CDN so all providers have the same list
			await this.fetchKnownModelList(this._fetcherService);
		} else {
			this._logService.logger.info(`BYOK: BYOK is NOT enabled - no model providers registered`);
		}
		this._byokUIService = new BYOKUIService(this._byokStorageService, this._modelRegistries);
		this.restoreModels(true);
	}

	private testLargeTelemetryPayload(): void {
		try {
			// Test different payload sizes
			const sizes = [
				500000,   // 500KB
				800000,   // 800KB
				1000000,  // ~1MB
				1048576,  // Exactly 1MB
			];

		}
	}
	private async fetchKnownModelList(fetcherService: IFetcherService): Promise<Record<string, BYOKKnownModels>> {
		const data = await (await fetcherService.fetch('https://main.vscode-cdn.net/extensions/copilotChat.json', { method: "GET" })).json();
		let knownModels: Record<string, BYOKKnownModels>;
		if (data.version !== 1) {
			this._logService.logger.warn('BYOK: Copilot Chat known models list is not in the expected format. Defaulting to empty list.');
			knownModels = {};
		} else {
			knownModels = data.modelInfo;
		}
		this._logService.logger.info('BYOK: Copilot Chat known models list fetched successfully.');
		return knownModels;
	}
}