## Titel
CI/CD Übung SS26 – Automatic Build with Security Checks

## Folgende Mitglieder
- Klaus Johannes Rusch
- Andreas Günter Kostecka
- Vinith Vedanayagam

## Einführung in das Thema - Exzerpt
Im Rahmen dieser Laborübung wird eine einfache Webapplikation mit Flask erstellt und mit einer CI/CD-Pipeline in GitLab verbunden. Ziel ist es, grundlegende Konzepte moderner Softwarebereitstellung praktisch umzusetzen. Dazu gehören automatisierte Tests, Containerisierung mit Docker, Security-Scans mit Trivy sowie ein lokales Deployment über einen GitLab Runner.

## Ziele / Aufgabenstellung
Ziel der Übung ist es, ein Git-Repository mit einer Beispielapplikation aufzusetzen und dieses mit einem lokalen GitLab Runner zu verbinden. Anschließend soll eine GitLab-CI/CD-Pipeline eingerichtet werden, die automatisierte Tests ausführt, einen Security-Check mittels Trivy durchführt und die Anwendung nach erfolgreichen Prüfungen automatisch deployt. Zusätzlich soll die Durchführung nachvollziehbar dokumentiert werden.

## Threat Analyse
Bei CI/CD-Umgebungen bestehen verschiedene Sicherheitsrisiken. Dazu zählen unsichere Abhängigkeiten, Fehlkonfigurationen in Containern, zu weitreichende Berechtigungen für Runner und Mitglieder sowie unkontrollierte Deployments. Ein weiteres Risiko besteht darin, Änderungen ungeprüft in produktionsnahe Umgebungen zu übernehmen. Durch automatisierte Tests, Security-Scans und das Prinzip minimaler Rechte können diese Risiken reduziert werden.

## Vor- und Nachteile

### Vorteile
- Automatisierte Tests erkennen Fehler frühzeitig.
- Wiederholbare Deployments reduzieren manuelle Fehler.
- Docker sorgt für eine reproduzierbare Laufzeitumgebung.
- Trivy unterstützt beim frühzeitigen Erkennen bekannter Schwachstellen.
- GitLab CI/CD ermöglicht eine zentrale, nachvollziehbare Pipeline.

### Nachteile
- Die Einrichtung der Umgebung benötigt initial zusätzlichen Aufwand.
- Lokale Runner müssen korrekt konfiguriert und gewartet werden.
- Fehlkonfigurationen in Pipeline oder Deployment-Skripten können direkte Auswirkungen auf die Zielumgebung haben.
- Zusätzliche Tools wie Docker, Trivy und Runner erhöhen die Komplexität der Umgebung.

## Security Best Practise
- Einsatz minimaler Berechtigungen für Benutzer und Runner
- Trennung von Test-, Security- und Deploy-Schritten
- Keine Speicherung sensibler Daten im Repository
- Verwendung schlanker Container-Images
- Durchführung automatisierter Tests vor dem Deployment
- Security-Scans vor der Auslieferung neuer Versionen
- Dokumentation aller sicherheitsrelevanten Entscheidungen

## Angabe der Laborübung + Lösungsweg
Die Laborübung sieht vor, eine beliebige Applikation in einem Git-Repository zu verwalten, einen lokalen GitLab Runner einzurichten und eine GitLab-CI/CD-Pipeline mit automatischem Deployment und Trivy-Scan zu konfigurieren. Als Lösungsansatz wurde eine einfache Flask-Webanwendung gewählt, die lokal getestet, in einem Docker-Container ausgeführt und später über GitLab CI/CD automatisiert gebaut, geprüft und deployt werden soll.

## Laborsetup
Es wurde auf den folgenden Maschinen im Computerlabor B.1.24 gearbeitet:
- host34
- host35
- host36

## Durchführung

Im Rahmen der Übung wurde zunächst ein GitLab-Repository mit dem Namen `automated-app` verwendet und lokal auf dem Hostsystem geklont. Nach dem Wechsel in das Projektverzeichnis wurde die Verzeichnisstruktur für die Webanwendung und die Tests angelegt.

### 1. Repository klonen und in das Verzeichnis wechseln

Zum Herunterladen des Repositories wurde folgender Befehl verwendet:

```bash
git clone https://git.hcw.ac.at/c2510537002/automated-app.git
cd automated-app
```

Anschließend wurde die grundlegende Projektstruktur erzeugt:

```bash
mkdir -p web tests
```

### 2. Flask-Anwendung erstellen

Im Verzeichnis `web/` wurde die eigentliche Beispielanwendung angelegt.  
Die Datei `web/app.py` enthält zwei einfache Endpunkte: `/plus_one` und `/square`.

Verwendeter Befehl:

```bash
cat > web/app.py <<'EOF'
from flask import request, Flask
import json

app = Flask(__name__)

@app.route("/plus_one")
def plus_one():
    x = int(request.args.get("x", 1))
    return json.dumps({"x": x + 1})

@app.route("/square")
def square():
    x = int(request.args.get("x", 1))
    return json.dumps({"x": x * x})
EOF
```

### 3. Teststruktur mit pytest anlegen

Für die automatisierten Tests wurde im Verzeichnis `tests/` eine Pytest-Struktur aufgebaut.  
Zunächst wurde eine `__init__.py` angelegt, damit das Verzeichnis korrekt als Python-Paket behandelt werden kann:

```bash
cat > tests/__init__.py <<'EOF'
# pytest package discovery
EOF
```

Danach wurde eine Fixture-Datei `conftest.py` erstellt, über die ein Test-Client für die Flask-Anwendung bereitgestellt wird:

```bash
cat > tests/conftest.py <<'EOF'
import pytest

@pytest.fixture
def client():
    from web.app import app
    app.config["TESTING"] = True
    return app.test_client()
EOF
```

Anschließend wurde die Testdatei `tests/test_api.py` angelegt.  
Darin werden beide API-Endpunkte mit konkreten Eingabewerten getestet:

```bash
cat > tests/test_api.py <<'EOF'
from urllib.parse import urlencode
import json

def call(client, path, params):
    url = path + "?" + urlencode(params)
    response = client.get(url)
    return json.loads(response.data.decode("utf-8"))

def test_plus_one(client):
    result = call(client, "/plus_one", {"x": 2})
    assert result["x"] == 3

def test_square(client):
    result = call(client, "/square", {"x": 2})
    assert result["x"] == 4
EOF
```

### 4. Coverage- und Abhängigkeitsdateien anlegen

Damit bei den Tests die Codebasis korrekt erkannt wird, wurde die Datei `.coveragerc` erzeugt:

```bash
cat > .coveragerc <<'EOF'
[run]
source = web
EOF
```

Die Python-Abhängigkeiten wurden in der Datei `requirements.txt` definiert:

```bash
cat > requirements.txt <<'EOF'
flask==3.0.3
gunicorn==22.0.0
pytest==8.2.2
pytest-cov==5.0.0
EOF
```

### 5. Dockerfile und Deployment-Skript erstellen

Für die spätere Containerisierung wurde ein Dockerfile erstellt.  
Dieses nutzt ein minimales Python-Alpine-Image, installiert die benötigten Abhängigkeiten und startet die Anwendung mit Gunicorn:

```bash
cat > Dockerfile <<'EOF'
FROM python:3.12-alpine

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY web ./web

EXPOSE 9061

USER nobody

CMD ["gunicorn", "--bind", "0.0.0.0:9061", "web.app:app"]
EOF
```

Zusätzlich wurde ein Deployment-Skript erstellt, das beim Deployment einen eventuell vorhandenen Container entfernt, das Image neu baut und den Container erneut startet:

```bash
cat > deploy.sh <<'EOF'
#!/bin/sh
set -eu

docker stop automated-app || true
docker rm automated-app || true

docker build -t automated-app:latest .
docker run -d --name automated-app -p 9061:9061 automated-app:latest
EOF
```

Danach wurde das Skript ausführbar gemacht:

```bash
chmod +x deploy.sh
```

### 6. GitLab-CI-Datei und `.gitignore` anlegen

Für die CI/CD-Pipeline wurde eine `.gitlab-ci.yml` erstellt.  
Sie definiert die Stages `test`, `security` und `deploy`:

```bash
cat > .gitlab-ci.yml <<'EOF'
stages:
  - test
  - security
  - deploy

test_job:
  stage: test
  image: python:3.12-alpine
  script:
    - pip install --no-cache-dir -r requirements.txt
    - pytest tests --cov=web --cov-report term

trivy_scan:
  stage: security
  image:
    name: aquasec/trivy:latest
    entrypoint: [""]
  script:
    - trivy fs --exit-code 1 --severity HIGH,CRITICAL .
  allow_failure: false

deploy_job:
  stage: deploy
EOF
```

Zusätzlich wurde eine `.gitignore` erstellt, um temporäre Python-Dateien und lokale Umgebungen nicht mit in das Repository aufzunehmen:

```bash
cat > .gitignore <<'EOF'
__pycache__/
*.pyc
.pytest_cache/
htmlcov/
.venv/
EOF
```

### 7. Projektstruktur prüfen

Zur Kontrolle wurde die Projektstruktur mit folgendem Befehl angezeigt:

```bash
find .
```

Dadurch konnte geprüft werden, ob alle erforderlichen Dateien und Verzeichnisse korrekt angelegt wurden.

### 8. Lokale Python-Umgebung vorbereiten

Da auf dem System zunächst weder `pip3` noch eine geeignete Python-Virtual-Environment verfügbar waren, wurde zuerst das Paket `python3-venv` installiert:

```bash
sudo apt-get update
sudo apt-get install -y python3-venv
```

Danach wurde eine virtuelle Python-Umgebung erstellt und aktiviert:

```bash
python3 -m venv .venv
source .venv/bin/activate
```

Anschließend wurden die Abhängigkeiten installiert:

```bash
pip install -r requirements.txt
```

Danach wurden die Tests lokal ausgeführt:

```bash
pytest tests
```

Die Tests wurden erfolgreich abgeschlossen. Das Ergebnis lautete:

```text
2 passed
```

### 9. Docker installieren und konfigurieren

Da Docker auf dem System anfangs nicht vorhanden war, wurde Docker mit der Paketverwaltung nachinstalliert:

```bash
sudo apt-get install -y docker.io
```

Danach wurde der Docker-Dienst aktiviert und gestartet:

```bash
sudo systemctl enable --now docker
sudo systemctl status docker --no-pager
```

Damit der Benutzer Docker ohne dauerhafte Root-Rechte verwenden kann, wurde dieser zur Docker-Gruppe hinzugefügt:

```bash
sudo usermod -aG docker $USER
newgrp docker
```

Im Anschluss wurde geprüft, ob Docker korrekt funktioniert:

```bash
docker --version
docker ps
```

### 10. Container lokal bauen und starten

Nachdem Docker korrekt installiert war, wurde das Container-Image der Anwendung gebaut:

```bash
docker build -t automated-app:latest .
```

Danach wurde ein Container daraus gestartet:

```bash
docker run -d --name automated-app -p 9061:9061 automated-app:latest
```

Für den späteren Test der HTTP-Endpunkte wurde zusätzlich `curl` installiert:

```bash
sudo apt-get install -y curl
```

Danach wurden die API-Endpunkte testweise aufgerufen:

```bash
curl "http://localhost:9061/plus_one?x=2"
curl "http://localhost:9061/square?x=2"
```

Zum Aufräumen wurde der Container danach wieder gestoppt und gelöscht:

```bash
docker stop automated-app
docker rm automated-app
```

### 11. Änderungen versionieren

Anschließend wurde der Status des Repositories geprüft:

```bash
git status
```

Danach wurden alle neu erstellten Dateien dem Repository hinzugefügt und committed:

```bash
git add .
git commit -m "Add Flask app with tests, Docker deployment, and GitLab CI"
```

Zur Prüfung des aktiven Branches wurde folgender Befehl verwendet:

```bash
git branch
```

### 12. Push auf geschützten Branch fehlgeschlagen

Zunächst wurde versucht, direkt auf den Branch `main` zu pushen:

```bash
git push origin main
```

Dieser Schritt schlug fehl, da `main` im Projekt als geschützter Branch konfiguriert war und direkte Pushes nicht erlaubt waren.

### 13. Feature-Branch erstellen und erfolgreich pushen

Daher wurde ein neuer Feature-Branch angelegt und die Änderungen auf diesen Branch gepusht:

```bash
git checkout -b feature/automated-app-setup
git push -u origin feature/automated-app-setup
```

### 14. Separaten Benutzer für den GitLab Runner erstellt

Im weiteren Verlauf der Übung wurde entschieden, den GitLab Runner nicht direkt unter dem primären Benutzer `it-security` zu betreiben. Stattdessen wurde im Sinne des Least-Privilege-Prinzips ein eigener Benutzer für die Runner-Umgebung angelegt.

Verwendeter Befehl:

```bash
sudo adduser lab2
```

Mit diesem Schritt wurde eine Trennung zwischen Entwicklungsumgebung und Runner-Umgebung vorbereitet. Ziel war es, den Runner möglichst isoliert vom eigentlichen Arbeitsbenutzer zu betreiben.

### 15. Docker-Zugriff des Runner-Benutzers geprüft

Nach der Benutzererstellung wurde auf den Benutzer `lab2` gewechselt und geprüft, ob Docker aus diesem Benutzerkontext verwendet werden kann.

Verwendete Befehle:

```bash
docker --version
docker ps
```

Die installierte Docker-Version konnte angezeigt werden. Der Zugriff auf laufende Container über `docker ps` diente als Test, ob der Benutzer bereits ausreichende Rechte auf den Docker-Socket besitzt.

### 16. Konfigurationsverzeichnis und Docker-Volume für den Runner vorbereitet

Für die Vorbereitung des containerisierten GitLab Runners wurde zunächst ein lokales Konfigurationsverzeichnis erzeugt:

```bash
mkdir -p ~/gitlab-runner/config
```

Zusätzlich wurde ein dediziertes Docker-Volume für die Konfiguration des GitLab Runners erstellt:

```bash
docker volume create gitlab-runner-config
```

Durch dieses Volume bleibt die Runner-Konfiguration persistent erhalten, auch wenn der eigentliche Runner-Container später gestoppt, gelöscht oder aktualisiert wird.

### 17. GitLab Runner als Docker-Container gestartet

Im nächsten Schritt wurde der GitLab Runner als Docker-Container gestartet. Dabei wurde sowohl das Docker-Socket des Hosts als auch das zuvor erstellte Konfigurations-Volume in den Container eingebunden.

Verwendeter Befehl:

```bash
docker run -d --name gitlab-runner --restart always \
  -v /var/run/docker.sock:/var/run/docker.sock \
  -v gitlab-runner-config:/etc/gitlab-runner \
  gitlab/gitlab-runner:latest
```

Die verwendeten Optionen bedeuten:

- `-d`: Start des Containers im Hintergrund
- `--name gitlab-runner`: Vergibt einen festen Containernamen
- `--restart always`: Startet den Container nach einem Neustart des Systems automatisch erneut
- `-v /var/run/docker.sock:/var/run/docker.sock`: Bindet den Docker-Socket des Hosts ein
- `-v gitlab-runner-config:/etc/gitlab-runner`: Bindet das persistente Runner-Konfigurationsvolume ein

### 18. Start des Runner-Containers überprüft

Nach dem Start des Containers wurde kontrolliert, ob der Runner-Container tatsächlich aktiv ist.

Verwendeter Befehl:

```bash
docker ps
```

Damit wurde überprüft, ob der Container `gitlab-runner` erfolgreich gestartet wurde und im Hintergrund läuft.

### 19. Aktueller Zwischenstand der Runner-Vorbereitung

Bis zu diesem Punkt wurden folgende Docker-bezogene Schritte für den lokalen GitLab Runner durchgeführt:

Copilot said: ## Einrichtung des GitLab Runners Im weiteren Verlauf
Einrichtung des GitLab Runners

Im weiteren Verlauf der Übung wurde ein lokaler GitLab Runner auf dem Hostsystem eingerichtet, damit die Pipeline-Jobs des Projekts automated-app lokal ausgeführt werden können.
1. Separaten Benutzer für den Runner erstellt

Zunächst wurde ein eigener Benutzer für den Runner-Betrieb angelegt, um Entwicklungs- und Runner-Umgebung voneinander zu trennen.
bash

sudo adduser lab2

Danach wurde auf diesen Benutzer gewechselt.
2. Docker-Zugriff geprüft

Anschließend wurde überprüft, ob Docker im Kontext des neuen Benutzers verfügbar ist:
bash

docker --version
docker ps

Damit wurde kontrolliert, ob Docker installiert ist und ob der Benutzer auf den Docker-Daemon zugreifen kann.
3. Runner-Konfigurationsverzeichnis und Volume vorbereitet

Für die Konfiguration des GitLab Runners wurde ein lokales Verzeichnis angelegt:
bash

mkdir -p ~/gitlab-runner/config

Zusätzlich wurde ein Docker-Volume erstellt, damit die Runner-Konfiguration persistent gespeichert wird:
bash

docker volume create gitlab-runner-config

4. GitLab Runner als Docker-Container gestartet

Der Runner wurde anschließend als Docker-Container gestartet.
Dabei wurden sowohl das Docker-Socket des Hosts als auch das Konfigurations-Volume in den Container eingebunden:
bash

docker run -d --name gitlab-runner --restart always \
  -v /var/run/docker.sock:/var/run/docker.sock \
  -v gitlab-runner-config:/etc/gitlab-runner \
  gitlab/gitlab-runner:latest

Danach wurde geprüft, ob der Container erfolgreich läuft:
bash

docker ps

5. Ersten Runner registriert

Im nächsten Schritt wurde der Runner bei der GitLab-Instanz registriert.
Dazu wurde ein temporärer GitLab-Runner-Container verwendet, der auf dasselbe Konfigurations-Volume zugreift:
bash

docker run --rm -it \
  -v gitlab-runner-config:/etc/gitlab-runner \
  gitlab/gitlab-runner:latest register \
  --url https://git.hcw.ac.at \
  --token <RUNNER_TOKEN>

Während der Registrierung wurden folgende Werte gesetzt:

    GitLab-URL: https://git.hcw.ac.at
    Runner-Name: docker-runner-host36
    Executor: docker
    Default Docker Image: alpine:latest

6. Logs des Runners kontrolliert

Nach der Registrierung wurden die Logs des Containers überprüft:
bash

docker logs gitlab-runner --tail 50

In den Logs erschienen zunächst Hinweise, dass die Datei /etc/gitlab-runner/config.toml noch nicht gefunden wurde. Später wurde jedoch auch angezeigt, dass die Konfiguration geladen wurde.
7. Falsches GitLab-Projekt erkannt

Im weiteren Verlauf stellte sich heraus, dass der zuerst registrierte Runner im falschen GitLab-Projekt angelegt worden war.
Daher musste ein neuer Project Runner direkt im richtigen Projekt automated-app erstellt werden.
8. Alten Runner bereinigt

Da lokal noch eine fehlerhafte oder veraltete Runner-Konfiguration vorhanden war, wurde der Runner vollständig zurückgesetzt.

Zuerst wurde der laufende Container gestoppt und gelöscht:
bash

docker stop gitlab-runner
docker rm gitlab-runner

Danach wurde das alte Konfigurations-Volume entfernt:
bash

docker volume rm gitlab-runner-config

Anschließend wurde ein neues, leeres Konfigurations-Volume erstellt:
bash

docker volume create gitlab-runner-config

9. Frischen Runner-Container neu gestartet

Nach der Bereinigung wurde der Runner-Container erneut gestartet:
bash

docker run -d --name gitlab-runner --restart always \
  -v /var/run/docker.sock:/var/run/docker.sock \
  -v gitlab-runner-config:/etc/gitlab-runner \
  gitlab/gitlab-runner:latest

10. Runner im richtigen Projekt neu registriert

Danach wurde der Runner erneut registriert, diesmal mit dem Token des richtigen Projekts automated-app:
bash

docker run --rm -it \
  -v gitlab-runner-config:/etc/gitlab-runner \
  gitlab/gitlab-runner:latest register \
  --url https://git.hcw.ac.at \
  --token <RUNNER_TOKEN_AUTOMATED_APP>

Auch hier wurden wieder folgende Einstellungen verwendet:

    GitLab-URL: https://git.hcw.ac.at
    Runner-Name: docker-runner-host36
    Executor: docker
    Default Docker Image: alpine:latest

11. Runner-Funktion erneut geprüft

Nach der erneuten Registrierung wurden die Logs nochmals überprüft:
bash

docker logs gitlab-runner --tail 50

Später wurde zusätzlich der Live-Log betrachtet:
bash

docker logs -f gitlab-runner

Dabei war zu erkennen, dass der Runner Jobs erfolgreich vom GitLab-Server empfing und verarbeitete. In den Logs erschienen unter anderem Meldungen wie:
Text

Checking for jobs... received
Submitting job to coordinator...ok
Job succeeded

Quelle:

https://docs.gitlab.com/ci/
https://docs.gitlab.com/tutorials/create_register_first_runner/
https://medium.com/@huseinzolkepli/how-to-ci-cd-flask-app-using-gitlab-ci-4297017acda1