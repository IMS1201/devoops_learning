pipeline {
    agent any

    environment {
        DOCKER_IMAGE = "${JOB_NAME.toLowerCase().replaceAll('[^a-z0-9-]', '-')}"
        DOCKER_TAG   = "${BUILD_NUMBER}"
    }

    stages {
        stage('Checkout') {
            steps {
                checkout scm
            }
        }

        stage('SonarQube Analysis') {
            steps {
                catchError(buildResult: 'SUCCESS', stageResult: 'UNSTABLE') {
                    script {
                        def sonarOk = sh(script: 'which sonar-scanner 2>/dev/null', returnStatus: true) == 0
                        if (sonarOk) {
                            withSonarQubeEnv('SonarQube') {
                                sh 'npx --yes sonar-scanner -Dsonar.projectKey=${env.JOB_NAME} -Dsonar.sources=. -Dsonar.host.url=${SONAR_HOST_URL}'
                            }
                        } else {
                            echo 'sonar-scanner not found — configure SonarQube Scanner in Jenkins → Manage Jenkins → Tools'
                        }
                    }
                }
            }
        }

        stage('Docker Build') {
            when { expression { return fileExists('frontend/Dockerfile') } }
            steps {
                script {
                    def dockerAvailable = sh(script: 'which docker 2>/dev/null || test -x /usr/bin/docker', returnStatus: true) == 0
                    if (dockerAvailable) {
                        def daemonOk = sh(script: 'docker info > /dev/null 2>&1', returnStatus: true) == 0
                        if (daemonOk) {
                            retry(2) {
                                sh "docker build -t ${DOCKER_IMAGE}:${DOCKER_TAG} ./frontend"
                            }
                            sh "docker tag ${DOCKER_IMAGE}:${DOCKER_TAG} ${DOCKER_IMAGE}:latest"
                        } else {
                            echo 'Docker daemon not reachable — run: docker exec jenkins chmod 666 /var/run/docker.sock'
                        }
                    } else {
                        echo 'Docker not available — install Docker in the Jenkins image or mount the socket'
                    }
                }
            }
        }

        stage('Trivy Scan') {
            when { expression { return fileExists('frontend/Dockerfile') } }
            steps {
                catchError(buildResult: 'SUCCESS', stageResult: 'UNSTABLE') {
                    script {
                        withEnv(["PATH+DEVPILOT=${env.HOME}/devpilot-tools/bin"]) {
                            def trivyOk = sh(script: 'which trivy 2>/dev/null', returnStatus: true) == 0
                            if (trivyOk) {
                                sh "trivy image --exit-code 0 --severity HIGH,CRITICAL --format table ${DOCKER_IMAGE}:${DOCKER_TAG} | tee trivy-report.txt"
                                archiveArtifacts artifacts: 'trivy-report.txt', allowEmptyArchive: true
                            } else {
                                echo 'Trivy not available — skipping scan'
                            }
                        }
                    }
                }
            }
        }

        stage('Push to Registry') {
            when { expression { return fileExists('frontend/Dockerfile') } }
            steps {
                catchError(buildResult: 'SUCCESS', stageResult: 'UNSTABLE') {
                    script {
                        withCredentials([usernamePassword(credentialsId: 'devpilot-registry-1780989894082', usernameVariable: 'REG_USER', passwordVariable: 'REG_PASS')]) {
                            sh '''
                                BRANCH_TAG=$(echo ${GIT_BRANCH:-${BRANCH_NAME:-main}} | sed 's|origin/||' | tr '/' '-' | tr '[:upper:]' '[:lower:]')
                                echo $REG_PASS | docker login -u $REG_USER --password-stdin
                                docker tag $DOCKER_IMAGE:$DOCKER_TAG pav30/basic-full-stack-app:$DOCKER_TAG-$BRANCH_TAG
                                docker push pav30/basic-full-stack-app:$DOCKER_TAG-$BRANCH_TAG
                            '''
                        }
                    }
                }
            }
        }

        stage('Deploy to VM') {
            when { expression { return fileExists('frontend/Dockerfile') } }
            steps {
                catchError(buildResult: 'UNSTABLE', stageResult: 'FAILURE') {
                    script {
                        withCredentials([sshUserPrivateKey(credentialsId: 'devpilot-deploy-pavan-3000-Basic-Full-Stack-App-master', keyFileVariable: 'SSH_KEY'), usernamePassword(credentialsId: 'devpilot-registry-1780989894082', usernameVariable: 'REG_USER', passwordVariable: 'REG_PASS')]) {
                            sh '''
                                BRANCH_TAG=$(echo ${GIT_BRANCH:-${BRANCH_NAME:-main}} | sed 's|origin/||' | tr '/' '-' | tr '[:upper:]' '[:lower:]')
                                REG_PASS_B64=$(echo -n "$REG_PASS" | base64 -w0)
                                ssh -i "$SSH_KEY" -o StrictHostKeyChecking=no -o ConnectTimeout=15 ubuntu@18.207.123.242 "echo $REG_PASS_B64 | base64 -d | docker login -u $REG_USER --password-stdin"
                                ssh -i "$SSH_KEY" -o StrictHostKeyChecking=no -o ConnectTimeout=15 ubuntu@18.207.123.242 "echo 'Deploying application...'"
                                PREV_TAG=$(ssh -i "$SSH_KEY" -o StrictHostKeyChecking=no -o ConnectTimeout=15 ubuntu@18.207.123.242 "grep 'image: pav30/basic-full-stack-app:' ~/devpilot-app/docker-compose.yml 2>/dev/null | awk '{print $2}' | head -1 || echo ''")
                                ssh -i "$SSH_KEY" -o StrictHostKeyChecking=no -o ConnectTimeout=30 ubuntu@18.207.123.242 "docker-compose pull froned && docker-compose up -d --no-deps froned" || {
                                    echo "Deploy failed — rolling back to $PREV_TAG"
                                    [ -n "$PREV_TAG" ] && ssh -i "$SSH_KEY" -o StrictHostKeyChecking=no -o ConnectTimeout=15 ubuntu@18.207.123.242 "sed -i 's|image: pav30/basic-full-stack-app:.*|image: $PREV_TAG|' ~/devpilot-app/docker-compose.yml && cd ~/devpilot-app && docker-compose up -d --no-deps froned" || true
                                    exit 1
                                }
                                echo "Deployed froned to http://18.207.123.242"
                            '''
                        }
                    }
                }
            }
        }
    }

    post {
        always {
            script {
                def status = currentBuild.result ?: 'IN_PROGRESS'
                def promptText = "Analyze this Jenkins CI/CD build and give 2-3 actionable bullet points: what passed, what failed (if any), and one improvement.\nJob: ${env.JOB_NAME} Build#${env.BUILD_NUMBER} Branch: ${env.GIT_BRANCH ?: env.BRANCH_NAME ?: 'unknown'} Status: ${status}"
                def aiDone = false

                for (def credId : ['devpilot-anthropic-key', 'ANTHROPIC_API_KEY']) {
                    if (aiDone) break
                    try {
                        withCredentials([string(credentialsId: credId, variable: 'ANTHROPIC_KEY')]) {
                            writeFile file: '.ai-payload.json', text: groovy.json.JsonOutput.toJson([
                                model: 'claude-haiku-4-5-20251001',
                                max_tokens: 350,
                                messages: [[role: 'user', content: promptText]]
                            ])
                            def rc = sh returnStatus: true, script: '''
                                curl -sf -X POST https://api.anthropic.com/v1/messages \
                                  -H 'Content-Type: application/json' \
                                  -H "x-api-key: $ANTHROPIC_KEY" \
                                  -H 'anthropic-version: 2023-06-01' \
                                  --max-time 30 \
                                  -d @.ai-payload.json \
                                  -o .ai-response.json
                            '''
                            if (rc == 0) {
                                def resp = new groovy.json.JsonSlurper().parseText(readFile('.ai-response.json'))
                                echo "\n=== Claude AI Build Analysis ===\n${resp.content[0].text}\n================================"
                                writeFile file: 'ai-analysis.json', text: readFile('.ai-response.json')
                                archiveArtifacts artifacts: 'ai-analysis.json', allowEmptyArchive: true
                                aiDone = true
                            }
                        }
                    } catch (ignored) {}
                }

                for (def credId : ['devpilot-openai-key', 'OPENAI_API_KEY']) {
                    if (aiDone) break
                    try {
                        withCredentials([string(credentialsId: credId, variable: 'OPENAI_KEY')]) {
                            writeFile file: '.ai-payload.json', text: groovy.json.JsonOutput.toJson([
                                model: 'gpt-4o-mini',
                                max_tokens: 350,
                                messages: [[role: 'user', content: promptText]]
                            ])
                            def rc = sh returnStatus: true, script: '''
                                curl -sf -X POST https://api.openai.com/v1/chat/completions \
                                  -H 'Content-Type: application/json' \
                                  -H "Authorization: Bearer $OPENAI_KEY" \
                                  --max-time 30 \
                                  -d @.ai-payload.json \
                                  -o .ai-response.json
                            '''
                            if (rc == 0) {
                                def resp = new groovy.json.JsonSlurper().parseText(readFile('.ai-response.json'))
                                echo "\n=== ChatGPT Build Analysis ===\n${resp.choices[0].message.content}\n==============================="
                                writeFile file: 'ai-analysis.json', text: readFile('.ai-response.json')
                                archiveArtifacts artifacts: 'ai-analysis.json', allowEmptyArchive: true
                                aiDone = true
                            }
                        }
                    } catch (ignored) {}
                }

                if (!aiDone) {
                    echo 'AI analysis skipped — configure an API key in DevPilot Settings (Claude or ChatGPT)'
                }
            }
        }
        success { echo 'Pipeline succeeded!' }
        failure  { echo 'Pipeline failed!' }
    }
}