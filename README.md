# 📅 SalePlan — Plan Sal Zajęciowych

Aplikacja webowa do układania i zarządzania planem sal zajęciowych na rok szkolny **2025/2026**. Zastępuje arkusz Excel — działa w przeglądarce, nie wymaga instalacji, nie zbiera żadnych danych.

---

## ✨ Funkcje

- **5 dni tygodnia** — osobny plan dla każdego dnia (Pon–Pt)
- **Struktura budynku** odwzorowana z oryginału:
  - Parter 0 → Segment A / B
  - Piętro I → Segment A / B
  - Piętro II → Segment A / B
  - Segment Żywnościowy (sale 16, 18, 21)
- **Godziny lekcyjne** 0–11
- **Przypisanie klas** do sal widoczne w nagłówkach
- **Edycja komórek** — nauczyciel, przedmiot, uwagi
- **Data „Obowiązuje od"** dla każdego dnia
- **Eksport do PDF** (druk w orientacji poziomej)
- **Zapis lokalny** — dane przechowywane w przeglądarce (`localStorage`)

---

## 🔒 Prywatność i dane

> **Aplikacja nie zbiera, nie wysyła ani nie przechowuje żadnych danych na zewnętrznych serwerach.**

Wszystkie dane (nauczyciele, przedmioty, uwagi) zapisywane są wyłącznie lokalnie w `localStorage` przeglądarki użytkownika. Jedyne połączenie zewnętrzne to pobranie czcionek z **Google Fonts** przy pierwszym uruchomieniu (może być wyłączone przez edycję pliku `index.html`).

---

## 🚀 Uruchomienie

### Lokalnie
Wystarczy otworzyć plik `index.html` w dowolnej przeglądarce — **żadna instalacja nie jest potrzebna**.

### GitHub Pages
1. Wgraj repozytorium na GitHub
2. Wejdź w **Settings → Pages**
3. Ustaw źródło: `Deploy from branch` → `main` → `/ (root)`
4. Aplikacja będzie dostępna pod adresem:
   ```
   https://<twoja-nazwa>.github.io/<nazwa-repo>/
   ```

---

## 🗂 Struktura repozytorium

```
/
├── index.html   ← cała aplikacja (jeden plik)
└── README.md    ← ten plik
```

Aplikacja jest celowo zbudowana jako **pojedynczy plik HTML** — nie wymaga żadnych zależności, bundlerów ani serwera.

---

## ⌨️ Skróty klawiszowe

| Skrót | Akcja |
|-------|-------|
| `Ctrl + Enter` | Zapisz wpis w oknie edycji |
| `Escape` | Zamknij okno edycji |

---

## 🛠 Dostosowanie

Aby zmienić strukturę sal lub klasy, edytuj w `index.html` sekcje:

- **`STRUCTURE`** — definicja pięter, segmentów i numerów sal
- **`CLASS_ASSIGNMENTS`** — przypisanie klas do kolumn dla każdego dnia
- **`HOURS`** — lista godzin lekcyjnych

---

## 📄 Licencja

Do użytku wewnętrznego. Brak licencji open-source — repozytorium może być prywatne.
