#!/usr/bin/env ruby
# Adds the AppUITests UI-test target and a shared "App" scheme (build + UI tests) to ios/App/App.xcodeproj.
# Idempotent. Run once after `npx cap add ios` re-creates the project (docs/ios/OMC_APP_ROADMAP.md → Simulator test).
#   gem install xcodeproj && ruby scripts/ios/add-uitest-target.rb
require 'xcodeproj'

path = File.expand_path('../../ios/App/App.xcodeproj', __dir__)
project = Xcodeproj::Project.open(path)
app = project.targets.find { |t| t.name == 'App' } or abort 'App target missing'

tests = project.targets.find { |t| t.name == 'AppUITests' }
unless tests
  tests = project.new_target(:ui_test_bundle, 'AppUITests', :ios, '15.0', nil, :swift)
  group = project.main_group.find_subpath('AppUITests', true)
  group.set_source_tree('<group>')
  group.set_path('AppUITests')
  file = group.new_reference('AppLaunchTests.swift')
  tests.add_file_references([file])
  tests.add_dependency(app)
end
# Always (re)applied, so an older generated target is repaired too. PRODUCT_NAME must be set: without it Xcode names
# the bundle "" and the build fails with "Multiple commands produce …-Runner.app/PlugIns/.xctest".
tests.product_reference.name = 'AppUITests.xctest'
tests.product_reference.path = 'AppUITests.xctest'
tests.build_configurations.each do |c|
  c.build_settings['TEST_TARGET_NAME'] = 'App'
  c.build_settings['PRODUCT_BUNDLE_IDENTIFIER'] = 'com.organizedmomcollective.app.uitests'
  c.build_settings['SWIFT_VERSION'] = '5.0'
  c.build_settings['TARGETED_DEVICE_FAMILY'] = '1,2'
  c.build_settings['GENERATE_INFOPLIST_FILE'] = 'YES'
  c.build_settings['CODE_SIGN_STYLE'] = 'Automatic'
  c.build_settings['PRODUCT_NAME'] = '$(TARGET_NAME)'
  c.build_settings['IPHONEOS_DEPLOYMENT_TARGET'] = '15.0'
end
project.save

scheme = Xcodeproj::XCScheme.new
scheme.configure_with_targets(app, tests, launch_target: true)
scheme.test_action.build_configuration = 'Debug'
scheme.save_as(path, 'App', true)
puts "AppUITests target and shared App scheme ready in #{path}"
