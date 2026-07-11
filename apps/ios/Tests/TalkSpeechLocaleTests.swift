import Foundation
import Testing
@testable import OpenClaw

@Suite struct TalkSpeechLocaleTests {
    @Test func localSelectionOverridesGatewayConfig() {
        let locale = TalkSpeechLocale.resolvedLocaleID(
            localSelection: "de-DE",
            gatewaySelection: "ru-RU",
            deviceLocaleID: "en-US",
            supportedLocaleIDs: ["de-DE", "ru-RU", "en-US"])

        #expect(locale == "de-DE")
    }

    @Test func automaticLocalSelectionAllowsGatewayConfig() {
        let locale = TalkSpeechLocale.resolvedLocaleID(
            localSelection: TalkSpeechLocale.automaticID,
            gatewaySelection: "ru_RU",
            deviceLocaleID: "en-US",
            supportedLocaleIDs: ["ru-RU", "en-US"])

        #expect(locale == "ru-RU")
    }

    @Test func providerPreferredLocaleAppliesWhenNoExplicitSelection() {
        let locale = TalkSpeechLocale.resolvedLocaleID(
            localSelection: TalkSpeechLocale.automaticID,
            gatewaySelection: nil,
            providerPreferredLocaleID: "zh-HK",
            deviceLocaleID: "en-US",
            supportedLocaleIDs: ["zh-HK", "en-US"])

        #expect(locale == "zh-HK")
    }

    @Test func explicitSelectionOverridesProviderPreferredLocale() {
        let locale = TalkSpeechLocale.resolvedLocaleID(
            localSelection: "en-US",
            gatewaySelection: nil,
            providerPreferredLocaleID: "zh-HK",
            deviceLocaleID: "fr-FR",
            supportedLocaleIDs: ["zh-HK", "en-US", "fr-FR"])

        #expect(locale == "en-US")
    }

    @Test func cantoneseAiProviderPrefersCantoneseRecognition() {
        #expect(TalkModeProviderSelection.cantoneseAi.preferredSpeechLocaleID == "zh-HK")
        #expect(TalkModeProviderSelection.gatewayDefault.preferredSpeechLocaleID == nil)
    }

    @Test func unsupportedConfiguredLocaleFallsBackToDeviceThenEnglish() {
        let deviceLocale = TalkSpeechLocale.resolvedLocaleID(
            localSelection: "zz-ZZ",
            gatewaySelection: nil,
            deviceLocaleID: "fr-FR",
            supportedLocaleIDs: ["fr-FR", "en-US"])
        let english = TalkSpeechLocale.resolvedLocaleID(
            localSelection: "zz-ZZ",
            gatewaySelection: nil,
            deviceLocaleID: "yy-YY",
            supportedLocaleIDs: ["en-US"])

        #expect(deviceLocale == "fr-FR")
        #expect(english == "en-US")
    }
}
