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

    /// A button or link by its text, ignoring case: CSS uppercases some (iOS reports "I HAVE THE WALL CALENDAR").
    private func control(_ name: String) -> XCUIElement {
        web.descendants(matching: .any).matching(NSPredicate(format: "(elementType == %d OR elementType == %d) AND label ==[c] %@",
            Int(XCUIElement.ElementType.button.rawValue), Int(XCUIElement.ElementType.link.rawValue), name)).firstMatch
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
            let next = web.buttons.matching(NSPredicate(format: "label BEGINSWITH[c] 'Next:' OR label BEGINSWITH[c] 'Open Today'")).firstMatch
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
        waitFor(control("I have the wall calendar"), "wall calendar unlock").tap()
        finishCleaningOnboarding()
        let firstTask = waitFor(text("Make beds"), "first Daily Reset task")
        firstTask.tap()
        waitFor(oneTaskDone, "progress after one checkmark")
        assertInsideSafeArea("Cleaning", topElement: text("Daily Reset"))
        shot("02-cleaning-one-done")

        // Family: Our Family Meeting first, then responsibilities and the Club.
        XCTAssertFalse(tab("Club").exists, "the old Club tab is still there")
        XCTAssertFalse(tab("Account").exists, "Account should be the profile icon, not a tab")
        tab("Family").tap()
        let family = waitFor(text("plays a part"), "Family tab")
        waitFor(text("Who does what"), "Family Responsibilities card")
        waitFor(text("Family Meeting Club"), "Family Meeting Club card")
        assertInsideSafeArea("Family", topElement: family)
        shot("03-family")
        text("Open the Club").tap()
        let club = waitFor(text("One small win"), "Club home")
        assertInsideSafeArea("Club", topElement: club)
        shot("03b-club")

        // Account, from the profile icon: signed out, no made-up family.
        tab("Today").tap()
        waitFor(text("little more calm"), "Today")
        waitFor(web.links.matching(NSPredicate(format: "label == 'Account and settings'")).firstMatch, "profile icon").tap()
        let account = waitFor(text("Sign in to see your family"), "Account sign-in panel")
        XCTAssertFalse(text("Rivera").exists, "Account shows a made-up family outside the demo")
        assertInsideSafeArea("Account", topElement: text("The people"))
        shot("04-account")

        // Club sign-in, then back to Today with the tab bar (no dead ends).
        waitFor(control("Sign in"), "Sign in button").tap()
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

    // MARK: - The family flow against the isolated test backend (docs/ios/FAMILY_E2E.md)

    private func button(_ prefix: String) -> XCUIElement {
        web.buttons.matching(NSPredicate(format: "label BEGINSWITH[c] %@", prefix)).firstMatch
    }

    /// A person chip (a button with aria-pressed): iOS reports it as a toggle or switch, not a button.
    private func chip(_ name: String) -> XCUIElement {
        web.descendants(matching: .any).matching(NSPredicate(format: "(elementType == %d OR elementType == %d OR elementType == %d) AND label ==[c] %@",
            Int(XCUIElement.ElementType.button.rawValue), Int(XCUIElement.ElementType.toggle.rawValue), Int(XCUIElement.ElementType.switch.rawValue), name)).firstMatch
    }

    private func typeInto(_ field: XCUIElement, _ text: String) {
        field.tap()
        app.typeText(text)
    }

    /// Runs only in CI's ios-family-e2e job (TEST_RUNNER_E2E=1), where the app was built against a throwaway local
    /// database seeded with the Parks: Jen and Sam, Maya (11) and Leo (7). Never against production.
    func testFamilyFlowWithTestBackend() throws {
        guard ProcessInfo.processInfo.environment["E2E"] == "1" else { throw XCTSkip("needs the isolated test backend (CI ios-family-e2e)") }
        app.launchArguments = ["-OMCResetWebStorageForTesting"]
        app.launch()
        XCTAssertTrue(web.waitForExistence(timeout: 30))
        waitFor(text("little more calm"), "Today")

        // Sign in as Jen (the test backend's code is 123456).
        waitFor(web.links.matching(NSPredicate(format: "label == 'Account and settings'")).firstMatch, "profile icon").tap()
        waitFor(control("Sign in"), "Sign in button").tap()
        typeInto(waitFor(web.textFields.firstMatch, "email field"), "jen@e2e.test")
        waitFor(control("Email me a code"), "send code").tap()
        let code = web.textFields.matching(NSPredicate(format: "value == '' OR value == nil")).firstMatch
        typeInto(waitFor(code, "code field"), "123456")
        waitFor(control("Sign in"), "Sign in with the code").tap()
        sleep(3)
        shot("e2e-01-signed-in")

        // A calendar event for Maya.
        tab("Calendar").tap()
        let f = DateFormatter(); f.locale = Locale(identifier: "en_US"); f.dateFormat = "EEEE, MMMM d"
        waitFor(web.buttons.matching(NSPredicate(format: "label == %@", "Add to \(f.string(from: Date()))")).firstMatch, "add to today").tap()
        typeInto(waitFor(web.textFields.firstMatch, "event title"), "Soccer practice")
        waitFor(text("All day"), "all day").tap()
        waitFor(chip("Maya"), "Maya chip").tap()
        waitFor(control("Save"), "save event").tap()
        waitFor(text("Soccer practice"), "the event on the calendar")
        shot("e2e-02-calendar-event")

        // "We agreed" in this month's Family Meeting.
        tab("Family").tap()
        waitFor(text("plays a part"), "Family tab")
        web.links.matching(NSPredicate(format: "label BEGINSWITH[c] 'Open' AND label CONTAINS[c] 'Family Meeting'")).firstMatch.tap()
        let agree = waitFor(button("We agreed: Maya"), "We agreed for Maya", timeout: 30)
        agree.tap()
        waitFor(button("Undo the agreement: Maya"), "agreed for Maya")
        shot("e2e-03-meeting-we-agreed")

        // Today and the calendar show it.
        tab("Today").tap()
        waitFor(text("trash"), "Today: the agreement")
        shot("e2e-04-today-agreed")
        tab("Calendar").tap()
        waitFor(text("agreed in our Family Meeting"), "Calendar: agreements panel").tap()
        waitFor(text("trash"), "Calendar: the agreement")
        shot("e2e-05-calendar-agreed")

        // Cleaning (a calendar owner): Maya's cleaning part.
        tab("Today").tap()
        waitFor(control("I have the wall calendar"), "wall calendar unlock").tap()
        finishCleaningOnboarding()
        waitFor(text("part in cleaning"), "Cleaning: the agreement")
        shot("e2e-06-cleaning-agreed")

        // Edit and reassign to Leo on Family Responsibilities.
        tab("Family").tap()
        waitFor(text("Who does what"), "responsibilities card").tap()
        waitFor(control("Edit or reassign"), "edit").tap()
        let words = waitFor(web.textViews.firstMatch, "agreement words")
        words.tap(); app.typeText(" Every Tuesday.")
        waitFor(chip("Maya"), "Maya chip").tap()
        waitFor(chip("Leo"), "Leo chip").tap()
        waitFor(control("Save"), "save").tap()
        waitFor(text("Every Tuesday"), "edited words")
        shot("e2e-07-reassigned")
        tab("Today").tap()
        waitFor(text("Every Tuesday"), "Today after the edit")
        XCTAssertTrue(text("Leo").waitForExistence(timeout: 10), "Today shows Leo")

        // Close and reopen: everything is still there.
        app.terminate()
        app.launchArguments = []
        app.launch()
        waitFor(text("Every Tuesday"), "agreement after relaunch", timeout: 30)
        shot("e2e-08-today-after-relaunch")
        tab("Calendar").tap()
        waitFor(text("Soccer practice"), "event after relaunch")
        shot("e2e-09-calendar-after-relaunch")
    }
}
