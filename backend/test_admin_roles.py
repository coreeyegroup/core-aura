import json
import os
import unittest
from unittest.mock import patch
from fastapi.testclient import TestClient
from app.main import app

class AdminRolesTest(unittest.TestCase):
    def setUp(self):
        self.client=TestClient(app)
        self.users={"Editor":{"token":"e"*64,"role":"editor"},"Reviewer":{"token":"r"*64,"role":"reviewer"},"Publisher":{"token":"a"*64,"role":"administrator"}}
        self.env=patch.dict(os.environ,{"CORE_AURA_ADMIN_USERS":json.dumps(self.users),"CORE_AURA_ADMIN_TOKEN":"legacy-admin"})
        self.env.start()
    def tearDown(self): self.env.stop()
    def test_identity_cannot_be_spoofed_by_operator_header(self):
        r=self.client.get('/api/admin/me',headers={'Authorization':'Bearer '+'e'*64,'X-Core-Aura-Operator':'Publisher'})
        self.assertEqual(r.json(),{'name':'Editor','role':'editor','verified':True})
        self.assertEqual(self.client.get('/api/admin/me').status_code,401)
    def test_editor_and_reviewer_permissions_are_enforced_server_side(self):
        r=self.client.patch('/api/admin/packs/example/review',headers={'Authorization':'Bearer '+'e'*64},json={'status':'reviewed','reviewer':'spoof','notes':'review notes','expected_revision':1})
        self.assertEqual(r.status_code,403)
        self.assertEqual(self.client.post('/api/admin/packs/example',headers={'Authorization':'Bearer '+'r'*64},json={}).status_code,403)
        r=self.client.patch('/api/admin/packs/example/review',headers={'Authorization':'Bearer '+'r'*64},json={'status':'published','reviewer':'spoof','notes':'review notes','expected_revision':1})
        self.assertEqual(r.status_code,403)
    def test_legacy_identity_is_explicit_and_malformed_configuration_fails_closed(self):
        self.assertEqual(self.client.get('/api/admin/me',headers={'Authorization':'Bearer legacy-admin'}).json()['verified'],False)
        with patch.dict(os.environ,{'CORE_AURA_ADMIN_USERS':'broken'}):
            self.assertEqual(self.client.get('/api/admin/me',headers={'Authorization':'Bearer legacy-admin'}).status_code,503)
