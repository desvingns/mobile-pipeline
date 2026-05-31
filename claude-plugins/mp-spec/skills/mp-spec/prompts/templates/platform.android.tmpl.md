---
id: templates/platform.android
version: 1.0.0
inputs: [pipeline/00_meta.yaml, pipeline/03_style.md, pipeline/05_data_model.md, pipeline/07_apk.md, user_answers_qC.yaml, user_answers_qD.yaml, user_answers_qE.yaml]
outputs: [platform/android.md]
model: n/a
owner_agent: orchestrator
tags: [template, tdd, android, platform]
platform: android
---

<!-- Source: monolith SKILL.md Step 10 — Phase 4: Aggregate final TDD (sections §6, §7 Android part, §4 Android part, §8, §9, §12 Android part) -->

<!-- platform:android -->

# Android Platform Appendix

## 6. Дизайн-система

> Источник: `07_apk.md` приоритетно > `03_style.md`.
> Если APK присутствует — все hex/sp/dp берутся из `07_apk.md` (exact_palette, exact_dimensions). Под каждым токеном в скобках указывать источник: `(APK)` или `(скриншоты, ±)`. Без APK — только `(скриншоты, ±)`.

### 6.1. Палитра

Таблица токенов:

| Токен | Light | Dark | Источник |
|-------|-------|------|----------|
| primary | `#...` | `#...` | (APK) / (скриншоты, ±) |
| onPrimary | `#...` | `#...` | |
| secondary | `#...` | `#...` | |
| ... | | | |

```kotlin
val LightColorScheme = lightColorScheme(
    primary = Color(0xFF...),
    onPrimary = Color(0xFF...),
    secondary = Color(0xFF...),
    // ...
)

val DarkColorScheme = darkColorScheme(
    primary = Color(0xFF...),
    onPrimary = Color(0xFF...),
    secondary = Color(0xFF...),
    // ...
)
```

> Если Q-C2 включает dark, или если `apk.exact_palette_dark_present == true` — добавить `DarkColorScheme`.

### 6.2. Типографика

```kotlin
val AppTypography = Typography(
    displayLarge = TextStyle(fontSize = <sp>.sp, fontWeight = FontWeight.Normal),
    headlineMedium = TextStyle(fontSize = <sp>.sp, fontWeight = FontWeight.SemiBold),
    bodyLarge = TextStyle(fontSize = <sp>.sp, fontWeight = FontWeight.Normal),
    // ...
)
```

> sp из `dimens.xml` если APK; иначе приближение по скриншотам.

### 6.3. Spacing tokens

```kotlin
object Spacing {
    val xs = 4.dp
    val s = 8.dp
    val m = 12.dp
    val l = 16.dp
    val xl = 24.dp
    val xxl = 32.dp
}
```

### 6.4. Shapes

```kotlin
val AppShapes = Shapes(
    small = RoundedCornerShape(<dp>.dp),
    medium = RoundedCornerShape(<dp>.dp),
    large = RoundedCornerShape(<dp>.dp),
)
```

> corner_radius из `dimens.xml` если APK.

### 6.5. Компоненты — Composable function signatures

```kotlin
@Composable
fun ButtonPrimary(text: String, onClick: () -> Unit, enabled: Boolean = true)

@Composable
fun CardItem(title: String, subtitle: String?, onClick: (() -> Unit)? = null)

// ... добавить по скриншотам
```

### 6.6. Иконки

Материал-набор или кастом. Если APK: список из `07_apk.md` (`notable_drawables`) — иконки, уже существующие как ассеты и доступные для переиспользования.

---

## 4 (Android). Screen State / Event / Action — Kotlin sealed classes

Для каждого экрана из §4 `design.tmpl.md`:

```kotlin
data class <Screen>State(
    val isLoading: Boolean = false,
    val errorMessage: String? = null,
    // screen-specific fields with neutral types mapped to Kotlin:
    //   String, Int, Long, BigDecimal, Instant, UUID, List<T>
)

sealed interface <Screen>Event {
    data class OnFieldChanged(val value: String) : <Screen>Event
    data object OnSubmitClicked : <Screen>Event
    // ...
}

sealed interface <Screen>Action {
    data class NavigateTo(val route: String) : <Screen>Action
    data class ShowSnackbar(val message: String) : <Screen>Action
    // ...
}
```

---

## 7 (Android). Модель данных — Room

### Room сущности

```kotlin
@Entity(tableName = "<table>")
data class <Entity>Entity(
    @PrimaryKey val id: String,
    @ColumnInfo(name = "<col>") val field: <KotlinType>,
    // ...
)
```

### DAO interfaces (заголовки методов)

```kotlin
@Dao
interface <Entity>Dao {
    @Query("SELECT * FROM <table> WHERE id = :id")
    suspend fun getById(id: String): <Entity>Entity?

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsert(entity: <Entity>Entity)

    @Delete
    suspend fun delete(entity: <Entity>Entity)
}
```

### Стратегия миграций

- Версия 1 → 2: <описание изменений>
- Использовать `Migration(from, to)` + `fallbackToDestructiveMigration()` только при `BuildConfig.DEBUG`.

---

## 8. Технические требования

8.1. **SDK**:
- `minSdk`: если APK — `<apk.min_sdk>` (из manifest), иначе `<Q-D1>`. `targetSdk`: 34. `compileSdk`: 34.

8.2. **Permissions** — если APK: `<apk.permissions>` (canonical). Иначе: из `02_business.md` `implied_permissions` + ручные добавления. Пометка каждого: `(APK)` или `(выведено из UI)`.

8.3. **Build types**: debug / release / staging (если monorepo)

8.4. **ProGuard/R8** — общий план (keep rules для `kotlinx.serialization`):
```proguard
-keepattributes *Annotation*, InnerClasses
-dontnote kotlinx.serialization.AnnotationsKt
-keepclassmembers class kotlinx.serialization.json.** { *** Companion; }
```

8.5. **Размер APK** цель — если APK: указать размер оригинала (`<apk.size_mb>`) как ориентир. Иначе: ≤15 MB MVP, ≤30 MB Production.

8.6. *(Если APK)* Архитектура оригинала: `<apk.architecture_guess>`, UI framework: `<apk.ui_framework_guess>` — для информации, как сделано в исходнике (не значит, что нужно повторять).

---

## 9. Интеграции (Android)

### 9.1. Backend API

- Authentication (Q-E2-driven)
- Endpoints — таблица: метод, путь, request, response, status, auth required
- Если APK содержит `endpoints_extracted` — подраздел «Эндпоинты, найденные в APK» с verbatim URL (ground truth). Сравнить с гипотезами `backend-api-extractor`.
- Error handling contract

### 9.2. Third-party SDK

> Если APK: использовать `apk.libraries_detected` (canonical). Это переопределяет `implied_sdks` из бизнес-анализа.

| SDK | Gradle coordinate | Назначение | Источник |
|-----|-------------------|-----------|----------|
| ... | `com.example:lib:<version>` | ... | (APK) / (выведено) |

### 9.3. Web-views / external links (если есть)

---

## 10 (Android). Локализация

10.1. Список языков — если APK: `<apk.locales_supported>` (canonical). Иначе Q-D4.

10.2. Структура `res/values/strings.xml` + `values-<locale>/strings.xml`. Если APK: упомянуть `<apk.string_count_default_locale>` строк в default locale как ориентир объёма.

10.3. Плюрализация (`plurals.xml`)

10.4. *(Если APK)* Ключевые бизнес-строки оригинала: таблица `key_business_strings_sample` из `07_apk.md` — buy-list текстов, который должен быть в нашей версии.

---

## 12 (Android). Тестовая стратегия — конкретные фреймворки

- **Unit** (ViewModel, UseCase) — JUnit + MockK + Turbine для `StateFlow`
- **UI** (Compose) — `composeTestRule` + semantics
- **Integration** (Repository) — OkHttp MockServer / Ktor mock
- **Снепшот-тесты** — Roborazzi (`@Test @Config(sdk=[33])`)
- **DB** — Room in-memory (unit) / on-device (instrumentation)
- **Frameworks**: JUnit 4, Turbine, `kotlinx-coroutines-test`, Robolectric, Roborazzi, Compose UI test

<!-- /platform:android -->
