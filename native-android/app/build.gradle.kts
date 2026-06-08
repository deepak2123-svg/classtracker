import org.jetbrains.kotlin.gradle.dsl.JvmTarget
import java.util.Properties

plugins {
    alias(libs.plugins.android.application)
    alias(libs.plugins.hilt.android)
    alias(libs.plugins.kotlin.android)
    alias(libs.plugins.kotlin.kapt)
    alias(libs.plugins.kotlin.compose)
}

fun loadFirebaseProperties(): Properties {
    val values = Properties()
    rootProject.file("firebase.defaults.properties").inputStream().use(values::load)
    val localFile = rootProject.file("firebase.local.properties")
    if (localFile.exists()) {
        localFile.inputStream().use(values::load)
    }
    return values
}

fun String.asBuildConfigString(): String =
    "\"${replace("\\", "\\\\").replace("\"", "\\\"")}\""

val firebaseProperties = loadFirebaseProperties()

kotlin {
    compilerOptions {
        jvmTarget.set(JvmTarget.JVM_17)
    }
}

android {
    namespace = "com.classtracker.nativeapp"
    compileSdk = 36

    defaultConfig {
        applicationId = "com.classtracker.app"
        minSdk = 24
        targetSdk = 36
        versionCode = 6
        versionName = "0.4.1"

        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"
        vectorDrawables.useSupportLibrary = true

        buildConfigField(
            "String",
            "FIREBASE_API_KEY",
            firebaseProperties.getProperty("firebaseApiKey").asBuildConfigString(),
        )
        buildConfigField(
            "String",
            "FIREBASE_APPLICATION_ID",
            firebaseProperties.getProperty("firebaseApplicationId").asBuildConfigString(),
        )
        buildConfigField(
            "String",
            "FIREBASE_PROJECT_ID",
            firebaseProperties.getProperty("firebaseProjectId").asBuildConfigString(),
        )
        buildConfigField(
            "String",
            "FIREBASE_STORAGE_BUCKET",
            firebaseProperties.getProperty("firebaseStorageBucket").asBuildConfigString(),
        )
        buildConfigField(
            "String",
            "FIREBASE_SENDER_ID",
            firebaseProperties.getProperty("firebaseSenderId").asBuildConfigString(),
        )
        buildConfigField(
            "String",
            "GOOGLE_WEB_CLIENT_ID",
            firebaseProperties.getProperty("googleWebClientId").asBuildConfigString(),
        )
    }

    flavorDimensions += "environment"
    productFlavors {
        create("beta") {
            dimension = "environment"
            applicationIdSuffix = ".nativebeta"
            versionNameSuffix = "-beta"
            buildConfigField("String", "ENVIRONMENT", "\"beta\"")
            buildConfigField(
                "boolean",
                "GOOGLE_SIGN_IN_CONFIGURED",
                firebaseProperties.getProperty("betaGoogleSignInConfigured", "false"),
            )
            buildConfigField("boolean", "NATIVE_ENTRY_CREATE_ENABLED", "true")
            buildConfigField("boolean", "NATIVE_ENTRY_EDIT_ENABLED", "true")
            buildConfigField("boolean", "NATIVE_ENTRY_DELETE_ENABLED", "true")
            resValue("string", "app_name", "Ledgr Teacher Beta")
        }
        create("production") {
            dimension = "environment"
            buildConfigField("String", "ENVIRONMENT", "\"production\"")
            buildConfigField("boolean", "GOOGLE_SIGN_IN_CONFIGURED", "true")
            buildConfigField("boolean", "NATIVE_ENTRY_CREATE_ENABLED", "false")
            buildConfigField("boolean", "NATIVE_ENTRY_EDIT_ENABLED", "false")
            buildConfigField("boolean", "NATIVE_ENTRY_DELETE_ENABLED", "false")
            resValue("string", "app_name", "Ledgr Teacher")
        }
    }

    buildTypes {
        debug {
            isMinifyEnabled = false
        }
        release {
            isMinifyEnabled = true
            isShrinkResources = true
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro",
            )
        }
    }

    buildFeatures {
        buildConfig = true
        compose = true
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    packaging {
        resources.excludes += "/META-INF/{AL2.0,LGPL2.1}"
    }
}

androidComponents {
    beforeVariants(selector().all()) { variant ->
        val environment = variant.productFlavors
            .firstOrNull { it.first == "environment" }
            ?.second

        if (
            (environment == "production" && variant.buildType == "debug") ||
            (environment == "beta" && variant.buildType == "release")
        ) {
            variant.enable = false
        }
    }
}

dependencies {
    implementation(project(":core:database"))
    implementation(project(":core:designsystem"))
    implementation(project(":core:firebase"))
    implementation(project(":core:model"))
    implementation(project(":core:sync"))
    implementation(project(":feature:auth"))
    implementation(project(":feature:classes"))
    implementation(project(":feature:entries"))
    implementation(project(":feature:profile"))
    implementation(project(":feature:today"))

    implementation(libs.androidx.activity.compose)
    implementation(libs.androidx.core.ktx)
    implementation(libs.androidx.credentials)
    implementation(libs.androidx.credentials.play.services.auth)
    implementation(libs.androidx.lifecycle.runtime.compose)
    implementation(libs.androidx.lifecycle.viewmodel.compose)
    implementation(libs.androidx.navigation.compose)
    implementation(libs.androidx.work.runtime.ktx)
    implementation(libs.googleid)
    implementation(libs.hilt.android)
    kapt(libs.hilt.compiler)

    implementation(platform(libs.firebase.bom))
    implementation(libs.firebase.auth)
    implementation(libs.firebase.firestore)

    implementation(platform(libs.androidx.compose.bom))
    implementation(libs.androidx.compose.material.icons.extended)
    implementation(libs.androidx.compose.material3)
    implementation(libs.androidx.compose.ui)
    implementation(libs.androidx.compose.ui.tooling.preview)

    testImplementation(libs.junit)
    testImplementation(libs.kotlinx.coroutines.test)

    androidTestImplementation(platform(libs.androidx.compose.bom))
    androidTestImplementation(libs.androidx.compose.ui.test.junit4)
    androidTestImplementation(libs.androidx.espresso.core)
    androidTestImplementation(libs.androidx.junit)

    debugImplementation(libs.androidx.compose.ui.test.manifest)
    debugImplementation(libs.androidx.compose.ui.tooling)
}

kapt {
    correctErrorTypes = true
}

hilt {
    enableAggregatingTask = true
}
