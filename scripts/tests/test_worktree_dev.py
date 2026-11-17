"""Behavior checks for isolated development environments (standard library only)."""
import contextlib
import importlib.util
import io
import json
import os
from pathlib import Path
import shutil
import socket
import subprocess
import tempfile
import unittest
from unittest.mock import patch


SCRIPT = Path(__file__).resolve().parents[1] / 'worktree-dev.py'
spec = importlib.util.spec_from_file_location('worktree_dev', SCRIPT)
dev = importlib.util.module_from_spec(spec)
spec.loader.exec_module(dev)


class ConfigurationTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.root = Path(self.tmp.name) / 'checkout with spaces'
        self.root.mkdir()

    def test_identity_is_stable_and_canonical(self):
        self.assertEqual(dev.settings(self.root), dev.settings(self.root / '..' / self.root.name))
        a = dev.settings(self.root, 0)
        self.assertEqual(a['CHRONOLIST_FRONTEND_PORT'], '20000')
        self.assertEqual(a['CHRONOLIST_BACKEND_PORT'], '20001')
        host = a['COMPOSE_PROJECT_NAME'] + '.localhost'
        self.assertEqual(a['CHRONOLIST_FRONTEND_ORIGIN'], 'http://' + host + ':20000')
        self.assertEqual(a['CHRONOLIST_API_BASE_URL'], 'http://' + host + ':20001')
        self.assertEqual(a['CHRONOLIST_BIND_ADDRESS'], '127.0.0.1')

    def test_same_basename_in_different_paths_is_separated(self):
        a = dev.settings(self.root)
        other = self.root / 'elsewhere' / self.root.name
        other.mkdir(parents=True)
        b = dev.settings(other)
        self.assertNotEqual(a['COMPOSE_PROJECT_NAME'], b['COMPOSE_PROJECT_NAME'])
        self.assertNotEqual(a['CHRONOLIST_FRONTEND_ORIGIN'], b['CHRONOLIST_FRONTEND_ORIGIN'])

    def test_slot_bounds(self):
        for slot in [-1, 10000]:
            with self.subTest(slot=slot), self.assertRaises(ValueError):
                dev.settings(self.root, slot)
        a = dev.settings(self.root, 9999)
        self.assertEqual(a['CHRONOLIST_BACKEND_PORT'], '39999')

    def test_init_is_idempotent_and_preserves_explicit_slot(self):
        first = dev.initialize(self.root, 12)
        contents = (self.root / '.env').read_bytes()
        self.assertEqual(dev.initialize(self.root), first)
        self.assertEqual(dev.load_settings(self.root), first)
        self.assertEqual((self.root / '.env').read_bytes(), contents)
        with self.assertRaises(ValueError):
            dev.initialize(self.root, 13)
        self.assertEqual((self.root / '.env').read_bytes(), contents)

    def test_existing_unmanaged_env_is_never_overwritten(self):
        env = self.root / '.env'
        env.write_text('PRIVATE_KEY=keep-me\n')
        with self.assertRaises(ValueError):
            dev.initialize(self.root)
        self.assertEqual(env.read_text(), 'PRIVATE_KEY=keep-me\n')

    def test_copied_config_cannot_operate_another_project(self):
        dev.initialize(self.root)
        other = self.root / 'other'
        other.mkdir()
        shutil.copyfile(self.root / '.env', other / '.env')
        with self.assertRaises(ValueError):
            dev.load_settings(other)

    def test_edited_or_extended_config_is_rejected(self):
        config = dev.initialize(self.root)
        env = self.root / '.env'
        original = env.read_text()
        for contents in [original.replace(config['COMPOSE_PROJECT_NAME'], 'victim'),
                         original + 'COMPOSE_FILE=elsewhere.yaml\n',
                         original + 'CHRONOLIST_SLOT=5\n']:
            with self.subTest(contents=contents):
                env.write_text(contents)
                with self.assertRaises(ValueError):
                    dev.load_settings(self.root)

    def test_symlink_env_is_not_followed(self):
        target = self.root / 'target'
        target.write_text('PRIVATE_KEY=untouched\n')
        try:
            (self.root / '.env').symlink_to(target)
        except OSError:
            self.skipTest('symlink creation unavailable')
        with self.assertRaises(ValueError):
            dev.initialize(self.root)
        self.assertEqual(target.read_text(), 'PRIVATE_KEY=untouched\n')


class LifecycleTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.root = Path(self.tmp.name)
        self.config = dev.initialize(self.root, 31)

    def test_hostile_environment_cannot_redirect_compose(self):
        with patch.dict(os.environ, {'COMPOSE_PROJECT_NAME': 'victim',
                                     'COMPOSE_FILE': '/tmp/victim.yaml',
                                     'COMPOSE_ENV_FILES': '/tmp/victim.env',
                                     'COMPOSE_PROFILES': 'migration',
                                     'CHRONOLIST_BACKEND_PORT': '8080',
                                     'CHRONOLIST_OTHER': 'bad', 'PATH': '/bin'}):
            env = dev.compose_environment(self.config)
        self.assertEqual(env['COMPOSE_PROJECT_NAME'], self.config['COMPOSE_PROJECT_NAME'])
        self.assertNotIn('COMPOSE_FILE', env)
        self.assertNotIn('COMPOSE_ENV_FILES', env)
        self.assertNotIn('COMPOSE_PROFILES', env)
        self.assertNotIn('CHRONOLIST_OTHER', env)
        self.assertEqual(env['CHRONOLIST_BACKEND_PORT'], '20063')
        self.assertEqual(env['PATH'], '/bin')

    def test_lifecycle_is_pinned_to_own_file_and_project(self):
        for action, tail in [('destroy', ['down', '--volumes']),
                             ('down', ['down']), ('stop', ['stop', 'backend', 'frontend']),
                             ('restart', ['restart', 'backend', 'frontend']),
                             ('status', ['ps', '--all']), ('logs', ['logs', '--tail', '100', 'backend', 'frontend'])]:
            with self.subTest(action=action), patch.object(dev.subprocess, 'run') as run:
                with contextlib.redirect_stdout(io.StringIO()):
                    dev.run_action(self.root, action)
                cmd = run.call_args.args[0]
                self.assertEqual(cmd, ['docker', 'compose', '--project-directory', str(self.root),
                                       '--env-file', str(self.root / '.env'),
                                       '-f', str(self.root / 'compose.yaml'),
                                       '-p', self.config['COMPOSE_PROJECT_NAME'], *tail])
                self.assertTrue(run.call_args.kwargs['check'])
                self.assertEqual(run.call_args.kwargs['cwd'], self.root)

    def test_invalid_config_fails_before_docker(self):
        (self.root / '.env').write_text('COMPOSE_PROJECT_NAME=victim\n')
        with patch.object(dev.subprocess, 'run') as run:
            with self.assertRaises(ValueError):
                dev.run_action(self.root, 'destroy')
            run.assert_not_called()

    def test_occupied_port_is_reported_without_starting_or_stopping(self):
        with socket.socket() as listener:
            listener.bind(('127.0.0.1', 0))
            listener.listen()
            port = listener.getsockname()[1]
            with self.assertRaisesRegex(ValueError, str(port)):
                dev.check_ports({'CHRONOLIST_FRONTEND_PORT': str(port),
                                 'CHRONOLIST_BACKEND_PORT': '20001'}, set())

    def test_own_running_ports_do_not_block_repeated_up(self):
        publisher = {'URL': '127.0.0.1', 'TargetPort': 5173, 'PublishedPort': 20062, 'Protocol': 'tcp'}
        response = json.dumps({'Service': 'frontend', 'State': 'running', 'Publishers': [publisher]})
        with patch.object(dev.subprocess, 'run', return_value=subprocess.CompletedProcess([], 0, response)):
            self.assertEqual(dev.running_ports(self.root, self.config), {20062})
        with socket.socket() as listener:
            listener.bind(('127.0.0.1', 0))
            port = listener.getsockname()[1]
            dev.check_ports({'CHRONOLIST_FRONTEND_PORT': str(port),
                             'CHRONOLIST_BACKEND_PORT': str(port)}, {port})

    def test_up_checks_ports_before_building(self):
        with patch.object(dev, 'running_ports', return_value=set()), \
             patch.object(dev, 'check_ports', side_effect=ValueError('occupied')), \
             patch.object(dev.subprocess, 'run') as run:
            with self.assertRaisesRegex(ValueError, 'occupied'):
                dev.run_action(self.root, 'up')
            run.assert_not_called()


if __name__ == '__main__':
    unittest.main()
