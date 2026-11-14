import XCTest

/// The real app in the iOS Simulator (docs/ios/OMC_APP_ROADMAP.md → Simulator test): launch, tap through the tab bar
/// inside the web view the way a person would, keep every screen inside the safe area, and prove a checkmark survives
/// an app restart, including one where iOS has wiped the web view's own storage (the native mirror restores it).
///
/// Screenshots are kept as attachments; CI exports them from the .xcresult bundle.
final class AppLaunchTests: XCTestCase {
    private var app: XCUIApplication!

    override func setUp() {
        continueAfterFailure = false
        app = XCUIApplication()
    }

    // MARK: - Helpers

    private var web: XCUIElement { app.webViews.firstMatch }

    /// Any element in the web view whose accessible label contains `text`.
    private func text(_ text: String) -> XCUIElement {
        web.descendants(matching: .any).matching(NSPredicate(format: "label CONTAINS[c] %@", text)).firstMatch
    }

    /// The cleaning progress ring: "1 of 6 tasks done today" (src/components/Progress.tsx).
    private var oneTaskDone: XCUIElement {
        web.descendants(matching: .any).matching(NSPredicate(format: "label BEGINSWITH '1 of' AND label CONTAINS 'done today'")).firstMatch
    }

    private func tab(_ name: String) -> XCUIElement {
        web.links.matching(NSPredicate(format: "label == %@", name)).firstMatch
    }

    @discardableResult
    private func waitFor(_ element: XCUIElement, _ what: String, timeout: TimeInterval = 20) -> XCUIElement {
        XCTAssertTrue(element.waitForExistence(timeout: timeout), "Not found: \(what)")
        return element
    }

    private func shot(_ name: String) {
        let attachment = XCTAttachment(screenshot: app.screenshot())
        attachment.name = name
        attachment.lifetime = .keepAlways
        add(attachment)
    }

    /// The tab bar sits above the home indicator and the page starts below the status bar / Dynamic Island.
    private func assertInsideSafeArea(_ screen: String, topElement: XCUIElement) {
        let window = app.windows.firstMatch.frame
        let today = tab("Today")
        waitFor(today, "\(screen): Today tab")
        XCTAssertTrue(today.isHittable, "\(screen): Today tab can't be tapped")
        // Home indicator area is 34 pt on Face ID iPhones; the tab's label must sit above it.
        XCTAssertLessThanOrEqual(today.frame.maxY, window.maxY - 20, "\(screen): tab bar runs under the home indicator")
        // Status bar / Dynamic Island: at least 44 pt on every current iPhone.
        XCTAssertGreaterThanOrEqual(topElement.frame.minY, window.minY + 44, "\(screen): content starts under the status bar")
    }

    private func finishCleaningOnboarding() {
        // A new device sees the companion's four-step first-run screen; step through it as she would.
        for _ in 0..<6 {
            let next = web.buttons.matching(NSPredicate(format: "label BEGINSWITH 'Next:' OR label BEGINSWITH 'Open Today'")).firstMatch
            guard next.waitForExistence(timeout: 3) else { return }
            next.tap()
        }
    }

    // MARK: - The test

    func testTabsSafeAreaAndProgressSurvivesRestart() {
        app.launchArguments = ["-OMCResetWebStorageForTesting"] // a clean first launch
        app.launch()
        XCTAssertTrue(web.waitForExistence(timeout: 30), "The web view never appeared")

        // Today.
        let title = waitFor(text("little more calm"), "Today title")
        assertInsideSafeArea("Today", topElement: title)
        shot("01-today")

        // A calendar owner opens the cleaning companion, finishes first-run, checks one task.
        waitFor(web.buttons["I have the wall calendar"], "wall calendar unlock").tap()
        finishCleaningOnboarding()
        let firstTask = waitFor(text("Make beds"), "first Daily Reset task")
        firstTask.tap()
        waitFor(oneTaskDone, "progress after one checkmark")
        assertInsideSafeArea("Cleaning", topElement: text("Daily Reset"))
        shot("02-cleaning-one-done")

        // Club.
        tab("Club").tap()
        let club = waitFor(text("One small win"), "Club home")
        assertInsideSafeArea("Club", topElement: club)
        shot("03-club")

        // Account: signed out, no made-up family.
        tab("Account").tap()
        let account = waitFor(text("Sign in to see your family"), "Account sign-in panel")
        XCTAssertFalse(text("Rivera").exists, "Account shows a made-up family outside the demo")
        assertInsideSafeArea("Account", topElement: text("The people"))
        shot("04-account")

        // Club sign-in, then back to Today with the tab bar (no dead ends).
        waitFor(web.links["Sign in"], "Sign in button").tap()
        waitFor(text("Welcome back"), "Club sign-in")
        assertInsideSafeArea("Club sign-in", topElement: text("Welcome back"))
        shot("05-club-sign-in")
        tab("Today").tap()
        waitFor(text("little more calm"), "Today after sign-in page")
        _ = account

        // Restart 1: a normal relaunch keeps the checkmark.
        app.terminate()
        app.launchArguments = []
        app.launch()
        waitFor(text("little more calm"), "Today after relaunch")
        tab("Cleaning").tap()
        finishCleaningOnboarding()
        waitFor(oneTaskDone, "checkmark after relaunch")
        shot("06-cleaning-after-relaunch")

        // Restart 2: iOS wiped the web view's storage; the native copy (Capacitor Preferences) brings it back.
        app.terminate()
        app.launchArguments = ["-OMCResetWebStorageForTesting"]
        app.launch()
        XCTAssertTrue(web.waitForExistence(timeout: 30))
        waitFor(text("little more calm"), "Today after storage wipe")
        let cleaningTab = tab("Cleaning")
        XCTAssertTrue(cleaningTab.waitForExistence(timeout: 20), "Cleaning tab gone after a storage wipe: the unlock wasn't restored")
        cleaningTab.tap()
        waitFor(oneTaskDone, "checkmark restored after a storage wipe")
        shot("07-cleaning-after-storage-wipe")
    }
}
