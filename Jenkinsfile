pipeline {
    agent any

    environment {
        IMAGE_NAME = 'image-to-pdf-app'
        CONTAINER_NAME = 'image-to-pdf-container'
        PORT = '3000'
    }

    stages {
        stage('Checkout') {
            steps {
                echo 'Checking out source code...'
                // Jenkins automatically checks out the repository it monitors
            }
        }

        stage('Build Docker Image') {
            steps {
                script {
                    echo "Building Docker image ${IMAGE_NAME}..."
                    bat "docker build -t ${IMAGE_NAME} ."
                }
            }
        }

        stage('Deploy Local Container') {
            steps {
                script {
                    echo "Deploying container on port ${PORT}..."
                    
                    // The '|| exit 0' prevents the script from failing if the container doesn't exist
                    bat '''
                        @echo off
                        echo Stopping existing container if it exists...
                        docker stop %CONTAINER_NAME% >nul 2>&1 || exit 0
                        echo Removing existing container if it exists...
                        docker rm %CONTAINER_NAME% >nul 2>&1 || exit 0
                    '''
                    
                    // Run new container in detached mode
                    bat "docker run -d -p %PORT%:80 --name %CONTAINER_NAME% %IMAGE_NAME%"
                }
            }
        }
    }

    post {
        success {
            echo "Successfully deployed Image to PDF App locally on http://localhost:${PORT}"
        }
        failure {
            echo 'Deployment Pipeline Failed!'
        }
    }
}
