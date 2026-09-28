import AppKit
import CoreGraphics
import Foundation

// Generates a reader-facing snapshot of the implementation as of 2026-09-28.
// Run: swift scripts/generate-current-system-guide.swift
let destination = URL(fileURLWithPath: "output/pdf/eldritch-horror-current-system-guide.pdf")
try FileManager.default.createDirectory(at: destination.deletingLastPathComponent(), withIntermediateDirectories: true)
let width: CGFloat = 612
let height: CGFloat = 792
let bounds = CGRect(x: 0, y: 0, width: width, height: height)
var pageRect = bounds
guard let pdf = CGContext(destination as CFURL, mediaBox: &pageRect, nil) else {
  fatalError("Cannot create PDF")
}

let ink = NSColor(calibratedRed: 0.08, green: 0.15, blue: 0.18, alpha: 1)
let muted = NSColor(calibratedRed: 0.36, green: 0.42, blue: 0.43, alpha: 1)
let teal = NSColor(calibratedRed: 0.08, green: 0.42, blue: 0.40, alpha: 1)
let gold = NSColor(calibratedRed: 0.68, green: 0.44, blue: 0.12, alpha: 1)
let rust = NSColor(calibratedRed: 0.60, green: 0.28, blue: 0.23, alpha: 1)
let paper = NSColor(calibratedRed: 0.97, green: 0.96, blue: 0.92, alpha: 1)
let pale = NSColor(calibratedRed: 0.91, green: 0.94, blue: 0.91, alpha: 1)
let paleGold = NSColor(calibratedRed: 0.97, green: 0.92, blue: 0.80, alpha: 1)
let paleRust = NSColor(calibratedRed: 0.97, green: 0.89, blue: 0.86, alpha: 1)
let white = NSColor.white

func box(_ rect: CGRect, fill: NSColor, radius: CGFloat = 12) {
  fill.setFill()
  NSBezierPath(roundedRect: rect, xRadius: radius, yRadius: radius).fill()
}

@discardableResult
func text(_ value: String, x: CGFloat, y: CGFloat, width: CGFloat, size: CGFloat = 10.5,
          color: NSColor = ink, bold: Bool = false, lineHeight: CGFloat = 1.25) -> CGFloat {
  let style = NSMutableParagraphStyle()
  style.lineSpacing = size * (lineHeight - 1)
  let font = bold ? NSFont.systemFont(ofSize: size, weight: .semibold) : NSFont.systemFont(ofSize: size)
  let attributes: [NSAttributedString.Key: Any] = [.font: font, .foregroundColor: color, .paragraphStyle: style]
  let attributed = NSAttributedString(string: value, attributes: attributes)
  let measured = attributed.boundingRect(with: NSSize(width: width, height: 1000), options: [.usesLineFragmentOrigin, .usesFontLeading]).height
  attributed.draw(in: CGRect(x: x, y: y, width: width, height: measured + 25))
  return y + measured
}

func label(_ value: String, x: CGFloat, y: CGFloat, color: NSColor = teal) {
  _ = text(value.uppercased(), x: x, y: y, width: 500, size: 9, color: color, bold: true)
}

func startPage(_ page: Int, eyebrow: String, title: String, subtitle: String) {
  pdf.beginPDFPage(nil)
  pdf.saveGState()
  pdf.translateBy(x: 0, y: height)
  pdf.scaleBy(x: 1, y: -1)
  NSGraphicsContext.current = NSGraphicsContext(cgContext: pdf, flipped: true)
  paper.setFill(); NSBezierPath(rect: bounds).fill()
  box(CGRect(x: 0, y: 0, width: width, height: 8), fill: teal, radius: 0)
  label(eyebrow, x: 42, y: 34)
  _ = text(title, x: 42, y: 54, width: 525, size: 24, bold: true, lineHeight: 1.1)
  _ = text(subtitle, x: 42, y: 92, width: 525, size: 10.5, color: muted)
  box(CGRect(x: 42, y: 745, width: 528, height: 1), fill: NSColor(calibratedWhite: 0.77, alpha: 1), radius: 0)
  _ = text("ELDRITCH HORROR WEB  /  CURRENT SYSTEM GUIDE", x: 42, y: 755, width: 430, size: 8, color: muted)
  _ = text("\(page) / 4", x: 530, y: 755, width: 40, size: 8, color: muted)
}

func endPage() {
  NSGraphicsContext.current = nil
  pdf.restoreGState()
  pdf.endPDFPage()
}

func card(_ title: String, body: String, x: CGFloat, y: CGFloat, width: CGFloat, height: CGFloat,
          fill: NSColor = white, accent: NSColor = teal) {
  box(CGRect(x: x, y: y, width: width, height: height), fill: fill)
  box(CGRect(x: x, y: y, width: 4, height: height), fill: accent, radius: 0)
  _ = text(title, x: x + 15, y: y + 13, width: width - 28, size: 12, bold: true)
  _ = text(body, x: x + 15, y: y + 38, width: width - 30, size: 10, color: ink, lineHeight: 1.22)
}

// Page 1 - mental model.
startPage(1, eyebrow: "The mental model", title: "How the system works now", subtitle: "Implementation snapshot - 28 September 2026")
box(CGRect(x: 42, y: 124, width: 528, height: 60), fill: paleGold)
_ = text("A multiplayer foundation, not yet a complete base-game loop.", x: 57, y: 137, width: 495, size: 13, color: ink, bold: true)
_ = text("Setup and key Action-phase interactions work. Encounter and Mythos resolution are still gated.", x: 57, y: 158, width: 490, size: 9.5, color: muted)

label("One action, four responsibilities", x: 42, y: 211)
card("1  Browser", body: "Shows the board, hand, status and choices. Sends an intent such as Travel or Rest; it does not decide the rules result.", x: 42, y: 238, width: 248, height: 100)
card("2  Colyseus room", body: "Identifies the player's seat, validates the message and version, serializes commands, and synchronizes allowed state.", x: 322, y: 238, width: 248, height: 100)
card("3  Pure rules engine", body: "Checks legality and computes the next canonical state and events from the command and explicit random inputs.", x: 42, y: 356, width: 248, height: 100)
card("4  Content catalog", body: "Provides the map, investigators, cards and rule data. A scanned card is not automatically an executable effect.", x: 322, y: 356, width: 248, height: 100)
_ = text("Browser  ->  room validation  ->  engine transition  ->  room projection  ->  browser", x: 64, y: 482, width: 490, size: 10, color: teal, bold: true)

label("Safety rules", x: 42, y: 530)
card("Server owns the truth", body: "Deck order, token pools and unrevealed choices stay private. The browser receives only information it may see.", x: 42, y: 555, width: 248, height: 130, fill: pale)
card("Every change is checked", body: "Commands are validated. Stale versions, wrong players, illegal phases and pending choices are rejected without changing the game.", x: 322, y: 555, width: 248, height: 130, fill: pale)
_ = text("Think of the browser as the table view, the room as the referee's desk, and the engine as the rulebook being applied.", x: 42, y: 699, width: 525, size: 9, color: muted)
endPage()

// Page 2 - player journey and phase reality.
startPage(2, eyebrow: "Player journey", title: "What a turn can do", subtitle: "Solid = implemented path; amber = partial; red = not yet playable")
card("LOBBY / SETUP  -  WORKING", body: "Players join a room, select distinct investigators, and the host selects an Ancient One. Start assigns locations, starting Assets, Doom/Omen, a private Mythos order, a private Mystery order, and a four-card Reserve.", x: 42, y: 124, width: 528, height: 107, fill: pale, accent: teal)
card("ACTION PHASE  -  PARTLY PLAYABLE", body: "Investigators act in order, usually with two actions. Travel, Rest, Prepare for Travel, Acquire Assets and same-space Trade have authoritative transitions. Delayed investigators stand up instead of acting. Some component actions and card-specific effects remain unsupported.", x: 42, y: 243, width: 528, height: 124, fill: paleGold, accent: gold)
card("ENCOUNTER PHASE  -  NOT PLAYABLE YET", body: "The engine can enter this phase, but the 36 scanned location cards are only typed transcriptions. They are not drawn or resolved. Mandatory Monster combat is internal-only and rejects unsupported card/possession effects.", x: 42, y: 379, width: 528, height: 112, fill: paleRust, accent: rust)
card("MYTHOS PHASE  -  NOT PLAYABLE YET", body: "The staged Mythos deck can be built privately at setup. Drawing cards, applying their icons and text, Reckoning, and advancing to the next round are not a finished gameplay path.", x: 42, y: 503, width: 528, height: 105, fill: paleRust, accent: rust)
box(CGRect(x: 42, y: 625, width: 528, height: 82), fill: white)
_ = text("A decision can pause play", x: 57, y: 638, width: 495, size: 12, bold: true)
_ = text("Dice tests, Clue rerolls and Asset purchases use a pending decision owned by one player. The choice survives a disconnect; the room re-sends private options when that player reconnects.", x: 57, y: 661, width: 495, size: 10)
endPage()

// Page 3 - content and rules support.
startPage(3, eyebrow: "Content and rules", title: "What is ready - and what is not", subtitle: "A card image, structured text and executable behavior are three different levels of readiness")
label("Verified game data", x: 42, y: 129)
card("Board and characters", body: "36 map spaces and 70 routes; 12 investigators; four Ancient Ones; nine Gates; 34 normal plus nine Epic Monster tokens.", x: 42, y: 154, width: 528, height: 83, fill: pale)
card("Card rosters", body: "16 Mysteries, 51 Mythos cards and 40 Assets are cataloged. Their presence does not mean every printed effect can execute.", x: 42, y: 248, width: 528, height: 83, fill: pale)
label("Location encounter cards", x: 42, y: 355)
box(CGRect(x: 42, y: 379, width: 528, height: 105), fill: paleGold)
_ = text("36 cards  x  3 printed location sections  =  108 typed rule branches", x: 57, y: 393, width: 495, size: 12, bold: true)
_ = text("General 12; America 8; Europe 8; Asia/Australia 8. The transcription records tests, modifiers, ordered outcomes, optional costs and choices. The catalog still says not_executable; the live room must not draw these yet.", x: 57, y: 420, width: 495, size: 10)
label("Missing or incomplete dependencies", x: 42, y: 510, color: rust)
card("Absent content", body: "36 Conditions, 20 Spells and 14 Artifacts need executable data. Research, Other World, Expedition and Special encounters are also missing.", x: 42, y: 535, width: 248, height: 119, fill: paleRust, accent: rust)
card("Unfinished behavior", body: "Many Asset, Mythos and Mystery effects; Monster-specific combat text; encounter choices and targeting; full setup placement; end-to-end phase progression.", x: 322, y: 535, width: 248, height: 119, fill: paleRust, accent: rust)
_ = text("The app deliberately stops or rejects unsupported cases rather than guessing a board-game outcome.", x: 42, y: 681, width: 525, size: 10, color: muted)
endPage()

// Page 4 - practical next milestone and source pointers.
startPage(4, eyebrow: "Next milestone", title: "The route to playable encounters", subtitle: "Build a small end-to-end slice, then expand it card by card")
let steps: [(String, String)] = [
  ("1  Private draw + legal deck", "At each investigator's space, offer only allowed encounter decks. Draw from a private deterministic order and reveal only the active card/section."),
  ("2  Resolve one complete card", "Add a typed continuation for its test, pass/fail branch, optional choice and ordered effects. Reuse the existing private decision and dice systems."),
  ("3  Finish dependencies", "Implement Conditions, Spells, Artifacts, target selection and possession discard before admitting cards that reference them."),
  ("4  Advance the phase", "One encounter per eligible investigator; enforce mandatory combat; only then move to Mythos. Add engine, room and browser tests."),
]
for (index, step) in steps.enumerated() {
  card(step.0, body: step.1, x: 42, y: 126 + CGFloat(index) * 110, width: 528, height: 97,
       fill: index == 0 ? pale : white, accent: index == 0 ? teal : gold)
}
box(CGRect(x: 42, y: 588, width: 528, height: 119), fill: paleGold)
_ = text("Where this guide came from", x: 57, y: 600, width: 490, size: 11, bold: true)
_ = text("Repository snapshot at commit 09ee8fd. Sources: docs/exec-plans/base-game-rules-implementation.md; docs/rules/base-game-location-encounters.md; packages/content/src/readiness.ts; packages/content/src/location-encounter-rules.ts; packages/engine/src/index.ts; packages/protocol/src/index.ts; apps/server/src/rooms/GameRoom.ts.", x: 57, y: 624, width: 490, size: 8.7, color: muted)
endPage()

pdf.closePDF()
print(destination.path)
