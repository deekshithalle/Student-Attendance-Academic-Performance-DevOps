pipeline {
    agent any

    stages {
        stage('Install Dependencies') {
            steps {
                bat 'npm.cmd ci'
            }
        }

        stage('Run Unit Tests') {
            steps {
                bat 'npm.cmd test'
            }
        }
    }

    post {
        success {
            echo 'Student Attendance pipeline completed successfully!'
        }
        failure {
            echo 'Pipeline failed. Please inspect the console output.'
        }
        always {
            echo 'Jenkins pipeline execution finished.'
        }
    }
}
