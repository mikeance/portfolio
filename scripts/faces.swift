// Detecta caras con Vision (macOS) y devuelve, por archivo, cuántas hay y el área de la mayor
// (fracción de la imagen). Uso: swift scripts/faces.swift img1 img2 ... > salida.json
import Foundation
import Vision
import ImageIO

var out: [String: [String: Double]] = [:]
for path in CommandLine.arguments.dropFirst() {
  guard let src = CGImageSourceCreateWithURL(URL(fileURLWithPath: path) as CFURL, nil),
        let cg = CGImageSourceCreateImageAtIndex(src, 0, nil) else { continue }
  let req = VNDetectFaceRectanglesRequest()
  let handler = VNImageRequestHandler(cgImage: cg, options: [:])
  try? handler.perform([req])
  let boxes = (req.results ?? []).map { $0.boundingBox }
  let maxArea = boxes.map { Double($0.width * $0.height) }.max() ?? 0
  out[path] = ["n": Double(boxes.count), "max": maxArea]
}
let data = try! JSONSerialization.data(withJSONObject: out, options: [])
print(String(data: data, encoding: .utf8)!)
