---
name: batch-grill-me
description: Entrevista por rondas para cerrar decisiones del proyecto SmartStudio sin dejar supuestos ocultos.
disable-model-invocation: true
---

# Batch Grill Me para SmartStudio

Usa esta skill para someter a revisión un plan, una especificación o una decisión del proyecto SmartStudio. La entrevista debe ser en español y usar exactamente el vocabulario de `CONTEXT.md`.

## Antes de preguntar

Inspecciona el repositorio y obtiene los hechos con herramientas. Lee, en este orden:

1. `AGENTS.md`.
2. `CONTEXT.md`.
3. `docs/agents/domain.md` y `docs/agents/issue-tracker.md`, si existen.
4. Los ADR relacionados, si existen.
5. La especificación y los tickets de la iniciativa activa bajo `.scratch/`.
6. El código, las pruebas y la documentación directamente relacionados con la decisión.

No pidas al usuario datos que ya estén en esos archivos o que puedan comprobarse en el entorno. No inventes requisitos, arquitectura, tecnologías ni criterios de aceptación.

El alcance por defecto es el módulo **Evento, captura y selección**. Si hay más de una iniciativa activa, identifica la que corresponda por el contexto de la conversación; si no se puede determinar, pregunta únicamente cuál iniciativa debe revisarse.

## Entrevista por rondas

Representa las decisiones como un árbol. La **frontera** es el conjunto de decisiones cuyos prerrequisitos ya están resueltos. En cada ronda:

- Formula todas las preguntas de la frontera actual en un solo mensaje.
- Numera cada pregunta.
- Incluye una respuesta recomendada, compatible con `CONTEXT.md`, la especificación vigente y las restricciones del proyecto.
- Separa las decisiones independientes de las que dependen de respuestas aún abiertas; las últimas esperan a una ronda posterior.
- Espera las respuestas del usuario antes de recalcular la frontera.

Las decisiones pertenecen al usuario. Los hechos pertenecen al entorno y debes verificarlos tú. No cierres una rama por silencio ni conviertas una recomendación en decisión aceptada.

## Guardas del proyecto

- Respeta la secuencia: `grill-me` → `to-spec` → `to-tickets` → `implement` → `code-review`.
- Antes de `to-spec`, consolida en `CONTEXT.md` solo los términos y hechos estables que el usuario haya confirmado durante la entrevista.
- Crea o modifica un ADR únicamente si se resolvió una decisión arquitectónica real; no uses ADRs para preferencias o requisitos.
- Mantén el procesamiento y los datos locales, la privacidad de las fotografías y la preferencia por herramientas gratuitas o de código abierto cuando sigan siendo decisiones confirmadas.
- Conserva el límite del primer módulo: no introduzcas edición, QR, impresión, mensajes desde iPad ni libro digital en esta entrevista salvo que el usuario cambie explícitamente el alcance.
- Mantén las fotografías, RAW, modelos, resultados, cachés y secretos fuera de Git.
- No adoptes TDD como metodología global.
- No hagas QA dentro de la aplicación ni implementes cambios durante la entrevista, salvo que el usuario lo pida de forma explícita.
- No crees commits automáticamente. La entrevista puede dejar notas o actualizar el contexto después de la confirmación final, pero la confirmación Git siempre requiere autorización explícita.

## Cierre

La sesión termina solo cuando la frontera está vacía: se visitaron todas las ramas relevantes y no quedan supuestos silenciosos. Presenta entonces un resumen de decisiones confirmadas, decisiones descartadas, preguntas fuera de alcance y riesgos pendientes.

No actúes sobre el diseño hasta que el usuario confirme que el resumen representa un entendimiento compartido. Tras esa confirmación, aplica únicamente las actualizaciones de contexto permitidas por `AGENTS.md` y deja `to-spec` como siguiente etapa.
