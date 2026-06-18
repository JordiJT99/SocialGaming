# Plataforma de Predicciones Deportivas + Fantasy + Offerwall + Sportsbook (Social Gaming)

---

## 1. Resumen del producto

Plataforma de entretenimiento deportivo inspirada en modelos tipo el antiguo PlayfulBet:

- Predicciones deportivas (core diario)
- Fantasy football (retención semanal)
- Ligas privadas entre amigos (viralidad)
- Sistema de puntos virtuales (economía cerrada)
- Offerwall (ver anuncios / instalar apps / completar tareas)
- Tienda de recompensas (camisetas, tarjetas regalo, sorteos)
- Modo apuestas por cuotas (sportsbook simulado o real según regulación)

El sistema combina:
- Social gaming
- Gamificación deportiva
- Economía de puntos
- Posible capa de apuestas tipo casa de apuestas (con cuotas)

---

## 2. Inspiración de producto (PlayfulBet-like)

Basado en plataformas tipo PlayfulBet:

- Predicciones gratuitas
- Rankings globales y sociales
- Moneda virtual (puntos)
- Recompensas no monetarias
- Alto componente social

Diferencia clave:
- Se separa claramente juego social vs apuestas con dinero real

---

## 3. Objetivo del proyecto

- Crear una app deportiva altamente adictiva y social
- Maximizar retención diaria y semanal
- Monetizar con:
  - Ads
  - Offerwall
  - Afiliación
  - Premium
  - (Opcional) sportsbook

---

## 4. Stack técnico inicial (MVP)

### Backend
- Firebase Auth
- Firestore DB
- Cloud Functions
- Firebase Hosting

### Alternativa
- Supabase (similar)

### Frontend
- Next.js / React (mobile-first web app)

### Infraestructura
- Inicialmente gratis o muy bajo coste
- Escalable automáticamente

---

## 5. APIs y datos

- APIs deportivas (LaLiga, Champions, etc.)
- Providers freemium
- posible scraping controlado (si legal)

---

## 6. Hosting

### Opción inicial
- PC personal siempre encendido
- Node.js server

### Opción recomendada
- VPS (5–10 €/mes)

---

## 7. Concepto de juego

### 7.1 Predicciones deportivas (core)
- 1X2
- marcador exacto
- eventos especiales
- puntos por acierto

---

### 7.2 Fantasy football
- jugadores reales
- puntuación por rendimiento real
- ligas por jornada o temporada

---

### 7.3 Ligas privadas
- usuarios crean ligas
- competición entre amigos
- viralidad orgánica

---

### 7.4 Modo apuestas (sportsbook con cuotas)

Sistema opcional basado en:

- Cuotas dinámicas por evento
- Apuestas simuladas o con valor interno
- Ejemplo:
  - Barça gana: 1.80
  - Empate: 3.20
  - Madrid gana: 2.10

Tipos de apuestas:
- resultado final
- marcador exacto
- combinadas
- handicaps

⚠️ IMPORTANTE:
Este módulo cambia completamente la naturaleza del producto:
- Si hay dinero real → requiere regulación de juego
- Si es solo puntos → sigue siendo social gaming

---

## 8. Sistema de puntos

### 8.1 Obtención
- predicciones correctas
- fantasy
- rachas diarias
- invitaciones
- offerwall:
  - anuncios
  - installs
  - registros

---

### 8.2 Control económico

- economía cerrada (sin cashout)
- sin conversión a dinero real
- emisión controlada
- sinks obligatorios

---

### 8.3 Sinks de puntos
- torneos de entrada
- boosts
- ligas premium
- tienda de recompensas

---

## 9. Offerwall (monetización clave)

- ver anuncios
- instalar apps
- completar tareas
- rewarded ads

Proveedores:
- redes tipo Tapjoy / ironSource / Fyber

---

## 10. Sistema de recompensas

### Tipos
- camisetas
- tarjetas regalo
- merchandising
- sorteos

### Modelo
- recompensas NO lineales
- mezcla de:
  - canje directo
  - sorteos
  - patrocinio

Ejemplo:
- camiseta: 20.000 puntos
- tarjeta regalo: 15.000–25.000 puntos
- sorteo: 500–2.000 puntos

---

## 11. Monetización

### 11.1 Offerwall
- principal motor inicial

### 11.2 Publicidad
- banners / rewarded ads

### 11.3 Afiliación
- apps deportivas
- fantasy externos

### 11.4 Premium
- stats avanzadas
- IA
- ligas premium
- eliminación de ads

### 11.5 Sportsbook (opcional)
- alto revenue potencial
- pero requiere regulación si hay dinero real

---

## 12. Arquitectura Firebase

### Flujo

Frontend → Firebase Auth → Firestore → Cloud Functions → APIs externas

---

## 13. Modelo de datos

### Users
- username
- points
- stats
- referral system

### Predictions
- userId
- matchId
- selection
- pointsBet
- result

### Matches
- equipos
- resultado
- estado

### FantasyTeams
- jugadores
- puntuación

### Leagues
- miembros
- tipo

### Transactions
- entradas/salidas de puntos

---

## 14. Modelo económico de puntos

### Emisión controlada
- límite mensual por usuario
- basado en skill

### Distribución
- predicciones
- fantasy
- offerwall

### Sinks
- recompensas
- torneos
- boosts

---

## 15. Estimación de ingresos

| MAU | Ingresos |
|-----|---------|
| 100 | 0–20 €/mes |
| 500 | 20–100 €/mes |
| 1.000 | 50–250 €/mes |
| 2.000 | 100–500 €/mes |
| 5.000 | 300–1.500 €/mes |
| 10.000 | 1.000–4.000 €/mes |

---

## 16. Costes

- Firebase: 0–50 €/mes
- APIs deportivas: 0–100 €/mes
- Hosting: 0–10 €/mes

Total:
<100 €/mes

---

## 17. Riesgos

### Regulatorio
- sportsbook con dinero real = licencia obligatoria
- evitar cashout en modelo social

### Producto
- complejidad excesiva
- baja retención si UX es mala

### Económico
- dependencia de offerwall
- coste de recompensas

---

## 18. Estrategia de crecimiento

### Fase 1
- predicciones
- ligas privadas
- ranking

### Fase 2
- fantasy
- retención

### Fase 3
- offerwall
- premium
- patrocinios

---

## 19. Viralidad

- ligas privadas entre amigos
- competición social directa
- invitaciones obligatorias
- ciclos deportivos (LaLiga, Champions)

---

## 20. Conclusión

Proyecto viable como desarrollo individual si:

- MVP simple
- foco en retención diaria
- infraestructura gratuita inicial
- economía cerrada bien diseñada

El éxito depende más de:
- viralidad
- retención
- simplicidad inicial

que de complejidad técnica.

---