#target photoshop

(function () {
  if (app.documents.length === 0) throw new Error("SmartStudio-Fondo necesita un documento abierto.");
  // La Action Fondo ejecuta primero SmartStudio-Natural. La máscara y el
  // completado conservador se terminan en el seam local versionado para poder
  // omitir el cambio cuando cabello, accesorios o bordes sean inciertos.
  app.displayDialogs = DialogModes.NO;
  app.activeDocument.flatten();
})();
