# Student Attendance and Academic Performance Management System

A Node.js/Express application for faculty to register students, record and update attendance, calculate attendance percentages, enter internal marks, and generate student performance reports.

## Modules
- Faculty login
- Student registration and student details
- Mark and update attendance
- Attendance percentage calculation
- Internal marks entry: Internal 1 (30), Internal 2 (30), Semester exam (60), Assignment (10)
- Total = Semester exam + average of Internal 1 and Internal 2 + Assignment (maximum 100)
- Student performance report generation

## Demo login
- Username: `faculty`
- Password: `faculty123`

Change these values using `FACULTY_USERNAME` and `FACULTY_PASSWORD` environment variables for local use. This is an academic demonstration app; the simple header-based API check is not intended for production security.

## Run locally (Windows PowerShell)
```powershell
npm.cmd install
npm.cmd start
```
Open http://localhost:3000.

## Run unit tests
```powershell
npm.cmd test
```

## Run Selenium UI tests
Start the app in one terminal:
```powershell
npm.cmd start
```
In a second terminal:
```powershell
npm.cmd run test:selenium
```
Chrome must be installed. Screenshots are saved in `test-evidence/`.

## Docker
```powershell
docker build -t student-attendance-app:1.0 .
docker run -d --name student-attendance-container -p 3001:3000 -e PORT=3000 student-attendance-app:1.0
docker ps
docker logs student-attendance-container
```
Open http://localhost:3001.

## Jenkins
Create a Pipeline job named `Student-Attendance-CI-CD`, choose Pipeline script from SCM, Git, and use:
- Repository URL: your own GitHub repository URL
- Branch: `*/main`
- Script Path: `Jenkinsfile`

The Jenkinsfile in this project installs dependencies and runs unit tests on a Windows Jenkins agent.

## Kubernetes
Build the image first. For Docker Desktop Kubernetes, apply:
```powershell
kubectl apply -f k8s/attendance-deployment.yaml
kubectl get deployments
kubectl get pods
kubectl get services
```
The manifest uses NodePort 30081. If that port is already allocated in your cluster, change `nodePort` to an available port in the allowed NodePort range (30000-32767) before applying.
Open http://localhost:30081 when the service is ready.

## Data storage
Application data is stored in `data/store.json` and created automatically on first start. The data directory is excluded from the Docker build context so each environment initializes its own sample data.
