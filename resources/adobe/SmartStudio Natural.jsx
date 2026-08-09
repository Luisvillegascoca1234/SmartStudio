#target photoshop

(function () {
  if (app.documents.length === 0) throw new Error("SmartStudio-Natural necesita un documento abierto.");
  var document = app.activeDocument;
  app.displayDialogs = DialogModes.NO;
  try {
    document.convertProfile("sRGB IEC61966-2.1", Intent.RELATIVECOLORIMETRIC, true, true);
  } catch (_) {
    // El documento ya puede estar en sRGB o no exponer un perfil convertible.
  }
  if (document.mode !== DocumentMode.RGB) document.changeMode(ChangeMode.RGB);
  if (document.bitsPerChannel !== BitsPerChannelType.EIGHT) document.bitsPerChannel = BitsPerChannelType.EIGHT;
  document.flatten();
  document.activeLayer.adjustBrightnessContrast(2, 3);
  document.activeLayer.applyUnSharpMask(40, 0.6, 1);
  var baseName = document.name.replace(/\.[^.]+$/, "");
  var destination = new File(document.path + "/" + baseName + "-SmartStudio.jpg");
  var options = new ExportOptionsSaveForWeb();
  options.format = SaveDocumentType.JPEG;
  options.quality = 94;
  options.includeProfile = false;
  options.interlaced = false;
  options.optimized = true;
  document.exportDocument(destination, ExportType.SAVEFORWEB, options);
  document.close(SaveOptions.DONOTSAVECHANGES);
})();
