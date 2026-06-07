pluginManagement {
    repositories {
        google()
        mavenCentral()
        gradlePluginPortal()
    }
}

dependencyResolutionManagement {
    repositoriesMode.set(RepositoriesMode.FAIL_ON_PROJECT_REPOS)
    repositories {
        google()
        mavenCentral()
    }
}

rootProject.name = "LedgrNative"

include(
    ":app",
    ":core:database",
    ":core:designsystem",
    ":core:firebase",
    ":core:model",
    ":core:sync",
    ":feature:auth",
    ":feature:classes",
    ":feature:entries",
    ":feature:profile",
    ":feature:today",
)
