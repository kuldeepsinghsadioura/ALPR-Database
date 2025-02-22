<div align="center">
<img src="https://mswebappcdn.azureedge.net/episerverprod/c48c63f7c47c4544bdc361ebc94ce61e/448551dd03a14b6c86f27f8195830b8f.png" width="350px"/>

# ALPR Database

<h4 align="center">A Fully-Featured Automated License Plate Recognition Database for Blue Iris + CodeProject AI Server</h4>

[![Feature Requests & Roadmap](https://img.shields.io/badge/Feature%20Requests%20&%20Roadmap-5e5ced?style=for-the-badge&logo=starship&logoColor=white&link=https://alprdatabase.featurebase.app/roadmap)](https://alprdatabase.featurebase.app/roadmap) [![Docker Hub](https://img.shields.io/badge/Docker%20Hub-1D63ED?style=for-the-badge&logo=Docker&logoColor=white&link=https://hub.docker.com/r/algertc/alpr-dashboard)](https://hub.docker.com/r/algertc/alpr-dashboard) ![Plates Processed](https://img.shields.io/badge/Plates%20Processed-1M+-00A1E0?style=for-the-badge&logo=CodeForces&logoColor=white) ![Release](https://img.shields.io/badge/Release-0.1.7-00A1E0?style=for-the-badge&logoColor=white)

<h4 align="center">
⭐ Please star the repository if you find the project useful ⭐</h4>

<!-- ![Docker Pulls](https://img.shields.io/docker/pulls/algertc/alpr-dashboard?style=for-the-badge&logo=docker&logoColor=white&label=Downloads&labelColor=1D63ED&color=1D63ED&link=https%3A%2F%2Fhub.docker.com%2Frepository%2Fdocker%2Falgertc%2Falpr-dashboard%2Fgeneral) -->

<!-- ![Plates Processed](https://img.shields.io/badge/Plates%20Processed-1M+-gray?labelColor=00A1E0&style=for-the-badge&logo=CodeForces&logoColor=white) -->

</div>

<br>

![App Screens](https://raw.githubusercontent.com/algertc/ALPR-Database/refs/heads/main/Images/Hero.jpg)

## :star2: Overview

I've been using [CodeProject AI](https://github.com/codeproject/CodeProject.AI-Server) with [Mike Lud's](https://github.com/MikeLud) license plate model on [Blue Iris](https://blueirissoftware.com/) for a couple years now, but in this setup, the ALPR doesn't really do a whole lot. Really, you have more of a license plate camera with some OCR as a bonus, and no nice way to take advantage the data other than parsing Blue Iris logs or paying $600+/year for PlateMinder or Rekor ALPR.

This project serves as a complement to a CodeProject Blue Iris setup, giving you a full-featured database to store and _actually use_ your ALPR data, **completely for free.** Complete with the following it has a very solid initial feature set and is a huge upgrade over the standard setup.

#### Features:

- Searchable database & fuzzy search
- Build labeled training sets from your traffic
- Live recognition feed
- Traffic Analytics
- Categorization and filtering
- Store information on known vehicles
- Push notifications
- Automation rules
- Customizable tagging
- Configurable retention
- Flexible API
- HomeAssistant integration
- Permissioned users

<br>

## 🔧 Installation

![Setup Time](https://img.shields.io/badge/Setup%20Time-%E2%88%BC5%20minutes-0ec423?style=for-the-badge)

The application is packaged as a Docker image. This is the fastest and most reliable way to deploy. Below is a done-for-you installation script that will create a Docker stack with both the application and a PostgreSQL database. The installation script is recommended and more carefully maintained, but manual installation instructions are also available [here](https://github.com/algertc/ALPR-Database/wiki/Manual-Installation).

<br>

### Prerequisites

You will need the following installed on your system.

- Docker
- Docker Compose
- Docker engine enabled and running

<br>

> [!TIP]
> If unfamiliar with Docker, an easy way to check all three of these boxes at once is to install [Docker Desktop](https://docs.docker.com/desktop/), which has a GUI and bunch of nice tools.

<br>

### Linux/MacOS

Create a new directory wherever you would like to store your ALPR data. Enter the directory in your terminal and paste in the below command. After that, everything will be set up automatically!

```bash
curl -sSL https://raw.githubusercontent.com/algertc/ALPR-Database/main/install.sh | bash
```

Or, if you prefer:

```bash
wget -qO- https://raw.githubusercontent.com/algertc/ALPR-Database/main/install.sh | bash
```

<br>

#### :bangbang: Note for Linux:

If your user is not in the Docker group, you will need to run with sudo using the command below:

```bash
curl -sSL https://raw.githubusercontent.com/algertc/ALPR-Database/main/install.sh | sudo bash
```

<br>

### Windows

Create a new directory wherever you would like to store your ALPR data. Open PowerShell with administrator priveleges and cd into your new install directory.

Paste in the below command. After that, everything will be set up automatically!

```shell
irm https://raw.githubusercontent.com/algertc/ALPR-Database/main/install.ps1 | iex
```

<br>
<br>

## ⚙️ Setup

### Get Your API Key

To start sending data, log in to the application and **navigate to settings -> security** in the bottom left hand corner. At the bottom of the page you should see an API key. Click the eye to reveal the key and copy it down for use in Blue Iris.

![enter image description here](https://raw.githubusercontent.com/algertc/ALPR-Database/refs/heads/main/Images/apikey.png)

<br>

### Set up an alert action within Blue Iris:

ALPR recognitions are sent to the `api/plate-reads` endpoint.

We can make use of the built-in macros to dynamically get the alert data and send it as our payload. It should look like this:

    { "plate_number":"&PLATE", "Image":"&ALERT_JPEG", "camera":"&CAM", "ALERT_PATH": "&ALERT_PATH", "ALERT_CLIP": "&ALERT_CLIP", "timestamp":"&ALERT_TIME" }

**Set your API key with the x-api-key header as seen below.**
![enter image description here](https://raw.githubusercontent.com/algertc/ALPR-Database/refs/heads/main/Images/blueiris.png)

Note: The &PLATE macro will only send one plate number per alert. If you need to detect multiple plates in a single alert/image, you can optionally use the memo instead of the plate number. Your payload should look like this:

    { "memo":"&MEMO", "Image":"&ALERT_JPEG", "camera":"&CAM", "timestamp":"&ALERT_TIME" }

#### Thats it! You're now collecting and storing your ALPR data.

<br>

## :camera: Screenshots

![enter image description here](https://raw.githubusercontent.com/algertc/ALPR-Database/refs/heads/main/Images/4.png)
![enter image description here](https://raw.githubusercontent.com/algertc/ALPR-Database/refs/heads/main/Images/3.png)
![enter image description here](https://github.com/algertc/ALPR-Database/blob/main/Images/2.png?raw=true)
![enter image description here](https://raw.githubusercontent.com/algertc/ALPR-Database/refs/heads/main/Images/1.png)
![enter image description here](https://raw.githubusercontent.com/algertc/ALPR-Database/refs/heads/main/Images/5.png)

## :warning: Disclaimer

This is meant to be a helpful hobby project and is still a work-in-progress. There's a good amount of spaghetti code in here and random things left over from the initial release. Not to be relied on for anything critical.
