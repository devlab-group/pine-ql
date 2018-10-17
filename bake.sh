task:init() {
    task:install
    npm init
}

task:install() {
    set -e
     # install test suit
    bake dev mocha istanbul should
    # install lint suit
    bake dev lint-staged pre-commit
}

# Install node package
task:i() {
    npm i $@
}

# Install dev dependency
task:dev() {
    npm i --save-dev $@
}

task:test() {
    npm run test
}

task:cov() {
    npm run cov
}

task:run() {
    docker exec -e NODE_ENV=${NODE_ENV:-development} -ti etblegal_server_1 $@
}

task:server() {
    task:run npm start server
}

task:mongo() {
    docker exec -ti etblegal_mongo_1 $@
}
