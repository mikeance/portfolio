import CoreText
import Foundation
// Uso: glyphs <fuente> <texto> <altoMayúsculas>  → JSON con el contorno SVG de cada letra y su caja
let args = CommandLine.arguments
let fontName = args[1], text = args[2], cap = Double(args[3])!
let probe = CTFontCreateWithName(fontName as CFString, 1000, nil)
let size = cap / Double(CTFontGetCapHeight(probe)) * 1000
let font = CTFontCreateWithName(fontName as CFString, CGFloat(size), nil)
var out: [[String: Any]] = []
var x: CGFloat = 0
let chars = Array(text.utf16)
var glyphs = [CGGlyph](repeating: 0, count: chars.count)
CTFontGetGlyphsForCharacters(font, chars, &glyphs, chars.count)
var adv = [CGSize](repeating: .zero, count: chars.count)
CTFontGetAdvancesForGlyphs(font, .horizontal, glyphs, &adv, chars.count)
for (i, g) in glyphs.enumerated() {
  var d = ""
  if let path = CTFontCreatePathForGlyph(font, g, nil) {
    var t = CGAffineTransform(a: 1, b: 0, c: 0, d: -1, tx: x, ty: 0)
    let p = path.copy(using: &t)!
    p.applyWithBlock { el in
      let e = el.pointee, pts = e.points
      func f(_ v: CGFloat) -> String { String(format: "%.2f", Double(v)) }
      switch e.type {
      case .moveToPoint: d += "M\(f(pts[0].x)),\(f(pts[0].y))"
      case .addLineToPoint: d += "L\(f(pts[0].x)),\(f(pts[0].y))"
      case .addQuadCurveToPoint: d += "Q\(f(pts[0].x)),\(f(pts[0].y)) \(f(pts[1].x)),\(f(pts[1].y))"
      case .addCurveToPoint: d += "C\(f(pts[0].x)),\(f(pts[0].y)) \(f(pts[1].x)),\(f(pts[1].y)) \(f(pts[2].x)),\(f(pts[2].y))"
      case .closeSubpath: d += "Z"
      @unknown default: break
      }
    }
    let bb = p.boundingBoxOfPath
    out.append(["ch": String(UnicodeScalar(chars[i])!), "d": d, "bb": [bb.minX, bb.minY, bb.maxX, bb.maxY], "adv": adv[i].width])
  }
  x += adv[i].width
}
let data = try! JSONSerialization.data(withJSONObject: ["font": fontName, "size": size, "glyphs": out])
print(String(data: data, encoding: .utf8)!)
