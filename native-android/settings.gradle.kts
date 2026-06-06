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
    ":core:designsystem",
    ":core:model",
    ":feature:classes",
    ":feature:profile",
    ":feature:today",
)
