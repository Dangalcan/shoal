import { describe } from 'vitest'
import { DescribeModal } from '../../../components/modals/DescribeModal'
import { createResourceModalTests } from '../../helpers/resource-modal-tests'

describe('DescribeModal', () => {
    createResourceModalTests(DescribeModal, {
        apiMethod: 'describeResource',
        titlePattern: /Describe Pod/i,
        subtitleText: 'default / test-pod',
        successData: 'Test output content',
        contentMatcher: 'Test output content',
        loadingPattern: /Describing test-pod\.\.\./i,
    })
})
