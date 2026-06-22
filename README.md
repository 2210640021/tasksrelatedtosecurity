# CI/CD Übung SS26 – Automatic Build with Security Checks

## Folgende Mitglieder
- Klaus Johannes Rusch
- Andreas Günter Kostecka
- Vinith Vedanayagam

## Einführung in das Thema - Exzerpt
Im Rahmen dieser Laborübung wird eine einfache Webapplikation mit Flask erstellt und mit einer CI/CD-Pipeline verbunden. Ziel ist es, grundlegende Konzepte moderner Softwarebereitstellung, automatisierter Tests, Security-Scans und automatischer Deployments praktisch umzusetzen.

## Ziele / Aufgabenstellung
Ziel der Übung ist es, ein Git-Repository mit einer Beispielapplikation aufzusetzen, einen lokalen Runner einzurichten und eine CI/CD-Pipeline mit automatischem Deployment und Security-Check mittels Trivy zu konfigurieren.

## Threat Analyse
Bei CI/CD-Umgebungen bestehen verschiedene Sicherheitsrisiken. Dazu zählen unsichere Abhängigkeiten, Fehlkonfigurationen in Containern, zu weitreichende Berechtigungen für Runner und Mitglieder sowie Schwachstellen, die erst spät im Deployment-Prozess erkannt werden.

## Vor- und Nachteile

### Vorteile
- Automatisierte Tests erkennen Fehler frühzeitig.
- Wiederholbare Deployments reduzieren manuelle Fehler.
- Docker sorgt für eine reproduzierbare Laufzeitumgebung.
- Trivy unterstützt beim frühzeitigen Erkennen bekannter Schwachstellen.
- GitHub Actions ermöglicht eine zentrale, nachvollziehbare Pipeline.

### Nachteile
- Die Einrichtung der Umgebung benötigt initial zusätzlichen Aufwand.
- Runner müssen korrekt konfiguriert und gewartet werden.
- Fehlkonfigurationen in Pipeline oder Deployment-Skripten können direkte Auswirkungen auf die Zielumgebung haben.
- Zusätzliche Tools wie Docker, Trivy und Runner erhöhen die Komplexität der Umgebung.

## Security Best Practice
- Einsatz minimaler Berechtigungen für Benutzer und Runner
- Trennung von Test-, Security- und Deploy-Schritten
- Keine Speicherung sensibler Daten im Repository
- Verwendung schlanker Container-Images
- Durchführung automatisierter Tests vor dem Deployment
- Security-Scans vor der Auslieferung neuer Versionen
- Dokumentation aller sicherheitsrelevanten Entscheidungen

## Angabe der Laborübung + Lösungsweg
Die Laborübung sieht vor, eine beliebige Applikation in einem Git-Repository zu verwalten, einen lokalen Runner einzurichten und eine CI/CD-Pipeline mit automatischem Deployment und Security-Check einzurichten. Der Umsetzungsweg wurde im Verlauf der Arbeit praktisch getestet und schrittweise aufgebaut.

## Laborsetup
Es wurde auf einer lokalen Virtual Machine gearbeitet. Zusätzlich wurde das Projekt über GitHub verwaltet und ein selbst gehosteter GitHub Actions Runner eingerichtet.

## Durchführung

Im Rahmen der Übung wurde zunächst das Repository lokal geklont und in das Projektverzeichnis gewechselt. Danach wurde die Verzeichnisstruktur geprüft und angepasst.

### 1. Repository klonen und in das Verzeichnis wechseln

```bash
git clone https://github.com/2210640021/tasksrelatedtosecurity.git
cd tasksrelatedtosecurity
```

### 2. Vorhandene Projektstruktur prüfen

```bash
find .
```

### 3. Workflow-Verzeichnis erstellen

```bash
mkdir -p .github/workflows
```

### 4. GitHub Actions Workflow anlegen

Die CI/CD-Pipeline wurde in `.github/workflows/ci-cd.yml` erstellt. Sie umfasst Test, Trivy-Security-Scan und Deployment.

```bash
cat > .github/workflows/ci-cd.yml <<'EOF'
name: CI-CD with Security Checks

on:
  push:
    branches:
      - main
  workflow_dispatch:

permissions:
  contents: read

jobs:
  test:
    name: Test application
    runs-on: [self-hosted, linux, x64]

    steps:
      - name: Checkout repository
        uses: actions/checkout@v4

      - name: Set up Python
        uses: actions/setup-python@v5
        with:
          python-version: "3.12"

      - name: Install dependencies
        run: |
          python -m pip install --upgrade pip
          pip install -r requirements.txt

      - name: Run tests
        run: |
          pytest tests

  trivy_scan:
    name: Trivy security scan
    runs-on: [self-hosted, linux, x64]

    steps:
      - name: Checkout repository
        uses: actions/checkout@v4

      - name: Run Trivy filesystem scan
        run: trivy fs --severity HIGH,CRITICAL --exit-code 1 .

  deploy:
    name: Deploy application
    runs-on: [self-hosted, linux, x64]
    needs:
      - test
      - trivy_scan
    if: github.ref == 'refs/heads/main'

    steps:
      - name: Checkout repository
        uses: actions/checkout@v4

      - name: Make deploy script executable
        run: chmod +x deploy.sh

      - name: Deploy
        run: ./deploy.sh
EOF
```

### 5. Workflow-Datei prüfen

```bash
cat .github/workflows/ci-cd.yml
```

### 6. Dockerfile und Deployment-Skript vorbereiten

Falls noch nicht vorhanden, wurden Dockerfile und Deploy-Skript genutzt bzw. geprüft. Das Deployment erfolgt über `deploy.sh`.

```bash
chmod +x deploy.sh
```

### 7. Lokale Python-Umgebung vorbereiten

```bash
sudo apt-get update
sudo apt-get install -y python3-venv
python3 -m venv .venv
source .venv/bin/activate
python -m pip install --upgrade pip
pip install -r requirements.txt
pip install pytest
```

### 8. Tests lokal ausführen

```bash
pytest tests
```

### 9. Trivy lokal bzw. im Workflow verwenden

Zur Sicherheitsprüfung wurde Trivy in die Pipeline eingebunden. Die Kontrolle erfolgte über den Trivy-Scan der Projektdateien.

```bash
trivy fs --severity HIGH,CRITICAL .
```

### 10. GitHub Actions Runner einrichten

Der Runner wurde lokal entpackt, konfiguriert und mit dem Repository verbunden.

```bash
mkdir actions-runner && cd actions-runner
curl -o actions-runner-linux-x64-2.335.1.tar.gz -L https://github.com/actions/runner/releases/download/v2.335.1/actions-runner-linux-x64-2.335.1.tar.gz
echo "4ef2f25285f0ae4477f1fe1e346db76d2f3ebf03824e2ddd1973a2819bf6c8cf  actions-runner-linux-x64-2.335.1.tar.gz" | shasum -a 256 -c
tar xzf ./actions-runner-linux-x64-2.335.1.tar.gz
./config.sh --url https://github.com/2210640021/tasksrelatedtosecurity --token <RUNNER_TOKEN>
./run.sh
```

Anschließend wurde der Runner als Service eingerichtet:

```bash
sudo ./svc.sh install
sudo ./svc.sh start
sudo ./svc.sh status
```

### 11. GitHub Runner-Logs kontrollieren

```bash
docker logs -f gitlab-runner
```

Hinweis: In der frühen Phase wurden mehrere Log- und Registrierungsversuche durchgeführt, bis der Runner erfolgreich mit GitHub verbunden war und Jobs angenommen hat.

### 12. Änderungen versionieren

```bash
git status
git add .
git commit -m "Add GitHub Actions CI/CD with Trivy and deploy"
git push origin main
```

Falls das Pushen der Workflow-Datei wegen fehlendem Scope blockiert wurde, war ein GitHub Personal Access Token mit `workflow`-Recht erforderlich.

## Ergebnis
Die Pipeline wurde erfolgreich eingerichtet. Die Jobs liefen anschließend in dieser Reihenfolge erfolgreich durch:
- Test application
- Trivy security scan
- Deploy application

## Quelle / Referenzen
- https://docs.github.com/actions
- https://docs.github.com/actions/hosting-your-own-runners
- https://aquasecurity.github.io/trivy/
